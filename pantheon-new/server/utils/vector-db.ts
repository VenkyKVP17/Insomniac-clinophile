/**
 * Vector Database — Pantheon Server
 * SQLite + sqlite-vec for local vector storage and KNN search.
 * Stores document chunks and their embeddings for semantic retrieval.
 */

import Database from 'better-sqlite3';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, statSync } from 'fs';

const dataDir = join(process.cwd(), 'data');
const VECTOR_DB_PATH = join(dataDir, 'pantheon_vectors.db');
const VECTOR_DIMENSIONS = 768; // text-embedding-004 default

// Resolve the sqlite-vec native extension path
// Using direct path instead of sqliteVec.load() to avoid CJS require issues in Nitro's ESM bundler
const VEC_EXTENSION_PATH = resolve(process.cwd(), 'node_modules/sqlite-vec-linux-arm64/vec0');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database | null = null;

export interface VectorChunk {
  id: number;
  file_path: string;
  chunk_index: number;
  content: string;
  file_modified: string;
  created_at: string;
}

export interface SearchResult {
  file_path: string;
  chunk_index: number;
  content: string;
  distance: number;
  similarity: number;
}

/**
 * Get or initialize the vector database connection.
 */
export function getVectorDb(): Database.Database {
  if (db) return db;

  db = new Database(VECTOR_DB_PATH);
  db.pragma('journal_mode = WAL');

  // Load sqlite-vec extension using better-sqlite3's native loadExtension
  db.loadExtension(VEC_EXTENSION_PATH);

  // Create metadata table for chunks
  db.exec(`
    CREATE TABLE IF NOT EXISTS vec_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_modified TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(file_path, chunk_index)
    );
  `);

  // Create index on file_path for fast lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vec_chunks_file_path ON vec_chunks(file_path);
  `);

  // Create vec0 virtual table for KNN search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
      chunk_id INTEGER PRIMARY KEY,
      embedding float[${VECTOR_DIMENSIONS}]
    );
  `);

  // Track indexing metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS vec_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  console.log('[VECTOR-DB] Database initialized at', VECTOR_DB_PATH);
  return db;
}

/**
 * Insert or update a chunk and its embedding.
 */
export function upsertChunk(
  filePath: string,
  chunkIndex: number,
  content: string,
  fileModified: string,
  embedding: number[]
): number {
  const conn = getVectorDb();

  const upsertChunkStmt = conn.prepare(`
    INSERT INTO vec_chunks (file_path, chunk_index, content, file_modified)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(file_path, chunk_index)
    DO UPDATE SET content = excluded.content,
                  file_modified = excluded.file_modified,
                  created_at = datetime('now')
  `);

  upsertChunkStmt.run(filePath, chunkIndex, content, fileModified);

  // Always SELECT the id to get a proper integer (avoids bigint from lastInsertRowid)
  const row = conn.prepare('SELECT id FROM vec_chunks WHERE file_path = ? AND chunk_index = ?').get(filePath, chunkIndex) as { id: number } | undefined;

  if (!row?.id) {
    throw new Error(`Failed to get chunk ID for ${filePath}:${chunkIndex}`);
  }

  const chunkId = Number(row.id);

  // Serialize embedding to float32 buffer
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  // Delete old vector if exists, then insert new one
  // NOTE: CAST(? AS INTEGER) required because better-sqlite3 binds Number as REAL,
  // but vec0 virtual tables require INTEGER primary keys
  conn.prepare('DELETE FROM vec_index WHERE chunk_id = CAST(? AS INTEGER)').run(chunkId);
  conn.prepare('INSERT INTO vec_index (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)').run(chunkId, embeddingBuffer);

  return chunkId;
}

/**
 * Delete all chunks and vectors for a given file.
 */
export function deleteByFile(filePath: string): number {
  const conn = getVectorDb();

  // Get chunk IDs first
  const chunks = conn.prepare('SELECT id FROM vec_chunks WHERE file_path = ?').all(filePath) as { id: number }[];
  const chunkIds = chunks.map(c => c.id);

  if (chunkIds.length === 0) return 0;

  // Delete vectors (CAST needed for vec0 virtual table)
  const placeholders = chunkIds.map(() => 'CAST(? AS INTEGER)').join(',');
  conn.prepare(`DELETE FROM vec_index WHERE chunk_id IN (${placeholders})`).run(...chunkIds);

  // Delete chunks
  const deleted = conn.prepare('DELETE FROM vec_chunks WHERE file_path = ?').run(filePath);

  return deleted.changes;
}

/**
 * Search for the most similar vectors using KNN.
 */
export function searchVectors(queryEmbedding: number[], topK: number = 5): SearchResult[] {
  const conn = getVectorDb();

  const embeddingBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);

  // vec0 KNN queries require `k = ?` constraint (not LIMIT)
  const results = conn.prepare(`
    SELECT
      vi.chunk_id,
      vi.distance,
      vc.file_path,
      vc.chunk_index,
      vc.content
    FROM vec_index vi
    JOIN vec_chunks vc ON vi.chunk_id = vc.id
    WHERE vi.embedding MATCH ?
      AND vi.k = ?
    ORDER BY vi.distance
  `).all(embeddingBuffer, topK) as Array<{
    chunk_id: number;
    distance: number;
    file_path: string;
    chunk_index: number;
    content: string;
  }>;

  return results.map(r => ({
    file_path: r.file_path,
    chunk_index: r.chunk_index,
    content: r.content,
    distance: r.distance,
    // Convert L2 distance to a 0-1 similarity score (approximate)
    similarity: 1 / (1 + r.distance),
  }));
}

/**
 * Get total number of indexed chunks.
 */
export function getChunkCount(): number {
  const conn = getVectorDb();
  const row = conn.prepare('SELECT COUNT(*) as count FROM vec_chunks').get() as { count: number };
  return row.count;
}

/**
 * Get number of unique indexed files.
 */
export function getFileCount(): number {
  const conn = getVectorDb();
  const row = conn.prepare('SELECT COUNT(DISTINCT file_path) as count FROM vec_chunks').get() as { count: number };
  return row.count;
}

/**
 * Get file modification time stored in the index.
 */
export function getIndexedFileMtime(filePath: string): string | null {
  const conn = getVectorDb();
  const row = conn.prepare('SELECT file_modified FROM vec_chunks WHERE file_path = ? LIMIT 1').get(filePath) as { file_modified: string } | undefined;
  return row?.file_modified ?? null;
}

/**
 * Get or set metadata values.
 */
export function getMeta(key: string): string | null {
  const conn = getVectorDb();
  const row = conn.prepare('SELECT value FROM vec_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  const conn = getVectorDb();
  conn.prepare('INSERT OR REPLACE INTO vec_meta (key, value) VALUES (?, ?)').run(key, value);
}

/**
 * Get database file size in bytes.
 */
export function getDbSize(): number {
  try {
    const stats = statSync(VECTOR_DB_PATH);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Close the database connection.
 */
export function closeVectorDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
