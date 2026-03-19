/**
 * Index Files Utility — Pantheon Server
 * On-demand indexing for specific changed files.
 * Used by webhooks and other real-time triggers.
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { relative } from 'path';
import { embedBatch } from './embeddings';
import { upsertChunk, deleteByFile, setMeta } from './vector-db';

/** Minimum content length to bother indexing */
const MIN_CONTENT_LENGTH = 30;

/**
 * Chunk a markdown document into overlapping segments.
 * Same chunking strategy as vault-indexer.ts.
 */
function chunkDocument(content: string, maxChunkSize = 500, overlap = 100): string[] {
  const paragraphs = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length > 0 && (current.length + trimmed.length + 2) > maxChunkSize) {
      chunks.push(current.trim());
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + trimmed;
    } else {
      current = current ? current + '\n\n' + trimmed : trimmed;
    }
  }

  if (current.trim().length > 20) {
    chunks.push(current.trim());
  }

  if (chunks.length === 0 && content.trim().length > 20) {
    chunks.push(content.trim().substring(0, maxChunkSize));
  }

  return chunks;
}

/**
 * Index specific files into the vector database.
 * Called by webhooks when files are pushed/changed.
 *
 * @param filePaths - Absolute paths to changed files
 * @param apiKey - Gemini API key
 * @param vaultPath - Root vault path (for relative path calculation)
 * @returns Object with counts of indexed, skipped, errors
 */
export async function indexSpecificFiles(
  filePaths: string[],
  apiKey: string,
  vaultPath: string = '/home/ubuntu/vp'
): Promise<{ indexed: number; skipped: number; errors: number }> {
  const result = { indexed: 0, skipped: 0, errors: 0 };

  // Filter to only .md files that exist
  const mdFiles = filePaths.filter(f =>
    f.endsWith('.md') &&
    existsSync(f) &&
    !f.includes('node_modules') &&
    !f.includes('.git/') &&
    !f.includes('.obsidian/')
  );

  if (mdFiles.length === 0) {
    return result;
  }

  for (const filePath of mdFiles) {
    try {
      const stats = statSync(filePath);
      const fileMtime = stats.mtime.toISOString();
      const relativePath = relative(vaultPath, filePath);

      const content = readFileSync(filePath, 'utf-8');
      if (content.trim().length < MIN_CONTENT_LENGTH) {
        result.skipped++;
        continue;
      }

      // Strip YAML frontmatter
      const cleanContent = content.replace(/^---[\s\S]*?---\n*/m, '');
      const chunks = chunkDocument(cleanContent);

      if (chunks.length === 0) {
        result.skipped++;
        continue;
      }

      // Delete old chunks for this file
      deleteByFile(filePath);

      // Embed with file context
      const textsToEmbed = chunks.map(chunk => `File: ${relativePath}\n\n${chunk}`);
      const embeddings = await embedBatch(textsToEmbed, apiKey);

      // Store
      for (let i = 0; i < chunks.length; i++) {
        upsertChunk(filePath, i, chunks[i], fileMtime, embeddings[i]);
      }

      result.indexed++;
      console.log(`[INDEX-FILES] ✓ ${relativePath} (${chunks.length} chunks)`);

    } catch (err: any) {
      result.errors++;
      console.error(`[INDEX-FILES] ✗ ${filePath}: ${err.message}`);
    }
  }

  if (result.indexed > 0) {
    setMeta('last_realtime_index', new Date().toISOString());
  }

  return result;
}
