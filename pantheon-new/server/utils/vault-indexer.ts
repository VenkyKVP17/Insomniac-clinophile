/**
 * Vault Indexer — Pantheon Server
 * Scans Obsidian vault .md files, chunks them, generates embeddings,
 * and stores them in the vector database for semantic search.
 */

import { promises as fs } from 'fs';
import { join, relative } from 'path';
import { existsSync, statSync } from 'fs';
import { embedBatch } from './embeddings';
import { upsertChunk, deleteByFile, getIndexedFileMtime, setMeta } from './vector-db';

/** Directories to always skip during indexing */
const SKIP_DIRS = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  '.output',
  '.nuxt',
  '.gemini',
]);

/** Files to skip */
const SKIP_FILES = new Set([
  '.DS_Store',
  'thumbs.db',
]);

export interface IndexOptions {
  /** Maximum number of files to index in this run (for batching) */
  maxFiles?: number;
  /** Force re-index even if file hasn't changed */
  forceReindex?: boolean;
  /** Specific subdirectories to index (relative to vault) */
  dirs?: string[];
}

export interface IndexResult {
  indexed: number;
  skipped: number;
  errors: number;
  deleted: number;
  duration: number;
  details: string[];
}

/**
 * Chunk a markdown document into overlapping segments.
 * Strategy: paragraph-based splitting with ~500 char target size.
 */
function chunkDocument(content: string, maxChunkSize = 500, overlap = 100): string[] {
  // Split by double newlines (paragraphs)
  const paragraphs = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed max, finalize current chunk
    if (current.length > 0 && (current.length + trimmed.length + 2) > maxChunkSize) {
      chunks.push(current.trim());
      // Keep the overlap from the end of current chunk
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + trimmed;
    } else {
      current = current ? current + '\n\n' + trimmed : trimmed;
    }
  }

  // Don't forget the last chunk
  if (current.trim().length > 20) { // Skip tiny trailing fragments
    chunks.push(current.trim());
  }

  // If no chunks were produced (e.g., single short paragraph), use the whole content
  if (chunks.length === 0 && content.trim().length > 20) {
    chunks.push(content.trim().substring(0, maxChunkSize));
  }

  return chunks;
}

/**
 * Recursively find all .md files in a directory.
 */
async function findMarkdownFiles(dir: string, vaultPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        // Skip the pantheon-server's own node_modules deep inside the vault
        if (fullPath.includes('pantheon-server/node_modules')) continue;
        const subFiles = await findMarkdownFiles(fullPath, vaultPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.warn(`[VAULT-INDEXER] Error reading directory ${dir}:`, err);
  }

  return files;
}

/**
 * Index vault files into the vector database.
 * Supports incremental indexing — only processes changed files.
 */
export async function indexVaultFiles(
  vaultPath: string,
  apiKey: string,
  options?: IndexOptions
): Promise<IndexResult> {
  const startTime = Date.now();
  const result: IndexResult = {
    indexed: 0,
    skipped: 0,
    errors: 0,
    deleted: 0,
    duration: 0,
    details: [],
  };

  if (!existsSync(vaultPath)) {
    result.details.push(`Vault path not found: ${vaultPath}`);
    result.duration = Date.now() - startTime;
    return result;
  }

  // Determine which directories to scan
  let scanDirs: string[];
  if (options?.dirs && options.dirs.length > 0) {
    scanDirs = options.dirs.map(d => join(vaultPath, d)).filter(d => existsSync(d));
    if (scanDirs.length === 0) {
      result.details.push('None of the specified directories exist');
      result.duration = Date.now() - startTime;
      return result;
    }
  } else {
    scanDirs = [vaultPath];
  }

  // Collect all .md files
  let allFiles: string[] = [];
  for (const dir of scanDirs) {
    const files = await findMarkdownFiles(dir, vaultPath);
    allFiles.push(...files);
  }

  // Apply maxFiles limit
  if (options?.maxFiles && allFiles.length > options.maxFiles) {
    // Sort by modification time (newest first) so we index recent files first
    allFiles.sort((a, b) => {
      try {
        return statSync(b).mtimeMs - statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    });
    allFiles = allFiles.slice(0, options.maxFiles);
  }

  console.log(`[VAULT-INDEXER] Found ${allFiles.length} .md files to process`);

  // Process files
  for (const filePath of allFiles) {
    try {
      const stats = statSync(filePath);
      const fileMtime = stats.mtime.toISOString();
      const relativePath = relative(vaultPath, filePath);

      // Check if file needs re-indexing
      if (!options?.forceReindex) {
        const indexedMtime = getIndexedFileMtime(filePath);
        if (indexedMtime && indexedMtime === fileMtime) {
          result.skipped++;
          continue;
        }
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      if (content.trim().length < 30) {
        result.skipped++;
        continue;
      }

      // Remove YAML frontmatter before chunking
      const cleanContent = content.replace(/^---[\s\S]*?---\n*/m, '');

      // Chunk the document
      const chunks = chunkDocument(cleanContent);
      if (chunks.length === 0) {
        result.skipped++;
        continue;
      }

      // Delete old chunks for this file (full re-embed)
      deleteByFile(filePath);

      // Generate embeddings in batch
      // Prepend file context to each chunk for better embedding quality
      const textsToEmbed = chunks.map((chunk, i) =>
        `File: ${relativePath}\n\n${chunk}`
      );

      const embeddings = await embedBatch(textsToEmbed, apiKey);

      // Store chunks and embeddings
      for (let i = 0; i < chunks.length; i++) {
        upsertChunk(filePath, i, chunks[i], fileMtime, embeddings[i]);
      }

      result.indexed++;
      result.details.push(`✓ ${relativePath} (${chunks.length} chunks)`);
      console.log(`[VAULT-INDEXER] Indexed: ${relativePath} (${chunks.length} chunks)`);

    } catch (err: any) {
      result.errors++;
      const relativePath = relative(vaultPath, filePath);
      result.details.push(`✗ ${relativePath}: ${err.message}`);
      console.error(`[VAULT-INDEXER] Error indexing ${filePath}:`, err.message);
    }
  }

  // Record last index time
  setMeta('last_index_time', new Date().toISOString());
  setMeta('last_index_count', String(result.indexed));

  result.duration = Date.now() - startTime;
  console.log(`[VAULT-INDEXER] Indexing complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors in ${result.duration}ms`);

  return result;
}
