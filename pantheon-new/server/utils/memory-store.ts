/**
 * NYX Long-Term Memory Store
 *
 * Persistent, searchable memory for every conversation NYX has with VPK.
 * Uses the existing Pantheon vector DB (better-sqlite3 + sqlite-vec) to store:
 *   - Every message pair (user + assistant) as a memory entry
 *   - FTS5 full-text search for keyword recall
 *   - Vector embeddings for semantic recall
 *
 * Memories are NEVER deleted. NYX remembers everything.
 */

import { getVectorDb } from './vector-db';
import { embedText } from './embeddings';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id?: number;
  timestamp: string;
  user_message: string;
  nyx_response: string;
  /** Auto-extracted topic keywords for fast filtering */
  topics: string;
  /** Importance: 0=routine, 1=notable, 2=important, 3=critical */
  importance: number;
}

export interface MemorySearchResult {
  id: number;
  timestamp: string;
  user_message: string;
  nyx_response: string;
  topics: string;
  importance: number;
  /** For FTS results: BM25 rank score */
  rank?: number;
  /** For vector results: cosine similarity */
  similarity?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Initialization
// ─────────────────────────────────────────────────────────────────────────────

let initialized = false;

/**
 * Initialize the memory tables in the existing vector DB.
 * Called lazily on first use.
 */
function ensureMemoryTables(): void {
  if (initialized) return;

  const db = getVectorDb();

  // Main memory table — stores every conversation exchange
  db.exec(`
    CREATE TABLE IF NOT EXISTS nyx_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      user_message TEXT NOT NULL,
      nyx_response TEXT NOT NULL,
      topics TEXT NOT NULL DEFAULT '',
      importance INTEGER NOT NULL DEFAULT 0,
      embedded INTEGER NOT NULL DEFAULT 0
    );
  `);

  // FTS5 index for keyword search across both user and NYX messages
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS nyx_memory_fts USING fts5(
      user_message,
      nyx_response,
      topics,
      content=nyx_memory,
      content_rowid=id,
      tokenize='porter unicode61'
    );
  `);

  // Triggers to keep FTS in sync with the main table
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS nyx_memory_ai AFTER INSERT ON nyx_memory BEGIN
      INSERT INTO nyx_memory_fts(rowid, user_message, nyx_response, topics)
      VALUES (new.id, new.user_message, new.nyx_response, new.topics);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS nyx_memory_ad AFTER DELETE ON nyx_memory BEGIN
      INSERT INTO nyx_memory_fts(nyx_memory_fts, rowid, user_message, nyx_response, topics)
      VALUES ('delete', old.id, old.user_message, old.nyx_response, old.topics);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS nyx_memory_au AFTER UPDATE ON nyx_memory BEGIN
      INSERT INTO nyx_memory_fts(nyx_memory_fts, rowid, user_message, nyx_response, topics)
      VALUES ('delete', old.id, old.user_message, old.nyx_response, old.topics);
      INSERT INTO nyx_memory_fts(rowid, user_message, nyx_response, topics)
      VALUES (new.id, new.user_message, new.nyx_response, new.topics);
    END;
  `);

  // Index on timestamp for chronological queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nyx_memory_ts ON nyx_memory(timestamp);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nyx_memory_importance ON nyx_memory(importance);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nyx_memory_embedded ON nyx_memory(embedded);
  `);

  initialized = true;
  console.log('[MEMORY-STORE] Tables initialized');
}

// ─────────────────────────────────────────────────────────────────────────────
// Topic Extraction (No AI needed)
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'about', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'its', 'your', 'his', 'her',
  'our', 'their', 'them', 'how', 'when', 'where', 'why', 'because',
  'until', 'while', 'like', 'also', 'know', 'want', 'need', 'tell',
  'said', 'says', 'okay', 'sure', 'yes', 'right', 'well', 'get',
  'got', 'going', 'take', 'make', 'made', 'come', 'came', 'look',
  'give', 'gave', 'think', 'thought', 'good', 'great', 'send', 'show',
  'check', 'please', 'thanks', 'thank', 'help', 'let', 'dont', 'keep',
  'here', 'there', 'back', 'still', 'much', 'many', 'been', 'does',
  'will', 'they', 'been', 'you', 'your', 'mine', 'sir',
]);

/**
 * Extract topic keywords from a message (no AI required).
 */
function extractTopics(userMessage: string, nyxResponse: string): string {
  const combined = `${userMessage} ${nyxResponse}`.toLowerCase();
  const words = combined.match(/\b[a-z]{4,}\b/g) || [];

  // Count word frequency, skip stop words
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  // Return top 10 keywords by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
    .join(' ');
}

/**
 * Estimate importance of a conversation (0-3).
 */
function estimateImportance(userMessage: string, nyxResponse: string): number {
  const msg = userMessage.toLowerCase();

  // Critical: explicit "remember", personal info, medical decisions
  if (/\b(remember|never forget|important|critical|emergency)\b/.test(msg)) return 3;

  // Important: preferences, decisions, scheduling
  if (/\b(prefer|decide|schedule|deadline|appointment|exam|payment|salary|emi)\b/.test(msg)) return 2;

  // Notable: tasks, duties, projects, people
  if (/\b(duty|shift|roster|project|task|remind|follow.?up|doctor|patient|finance|budget)\b/.test(msg)) return 1;

  // Routine: everything else
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a conversation exchange to long-term memory.
 * This is the main entry point — call after every Telegram interaction.
 */
export function saveMemory(userMessage: string, nyxResponse: string): number {
  ensureMemoryTables();
  const db = getVectorDb();

  const topics = extractTopics(userMessage, nyxResponse);
  const importance = estimateImportance(userMessage, nyxResponse);
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO nyx_memory (timestamp, user_message, nyx_response, topics, importance, embedded)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  const result = stmt.run(timestamp, userMessage, nyxResponse, topics, importance);
  const memoryId = Number(result.lastInsertRowid);

  console.log(`[MEMORY-STORE] Saved memory #${memoryId} (importance=${importance}, topics="${topics.substring(0, 50)}")`);
  return memoryId;
}

/**
 * Embed unembedded memories in the background.
 * Call this periodically or after saving memories.
 * Stores embeddings in the existing vec_index + vec_chunks tables
 * with a special file_path prefix 'memory://' to distinguish from vault files.
 */
export async function embedPendingMemories(apiKey: string, batchSize: number = 5): Promise<number> {
  ensureMemoryTables();
  const db = getVectorDb();

  const pending = db.prepare(`
    SELECT id, user_message, nyx_response, timestamp
    FROM nyx_memory
    WHERE embedded = 0
    ORDER BY id ASC
    LIMIT ?
  `).all(batchSize) as Array<{ id: number; user_message: string; nyx_response: string; timestamp: string }>;

  if (pending.length === 0) return 0;

  let embedded = 0;

  for (const mem of pending) {
    try {
      // Combine user message and NYX response for embedding
      const text = `VPK: ${mem.user_message}\nNYX: ${mem.nyx_response}`;
      const embedding = await embedText(text.substring(0, 8000), apiKey);

      // Store in vec_chunks with 'memory://' prefix to distinguish from vault files
      const filePath = `memory://conversation/${mem.id}`;
      const content = text;

      // Insert into vec_chunks
      const upsertStmt = db.prepare(`
        INSERT INTO vec_chunks (file_path, chunk_index, content, file_modified)
        VALUES (?, 0, ?, ?)
        ON CONFLICT(file_path, chunk_index)
        DO UPDATE SET content = excluded.content, file_modified = excluded.file_modified
      `);
      upsertStmt.run(filePath, content, mem.timestamp);

      // Get the chunk ID
      const row = db.prepare('SELECT id FROM vec_chunks WHERE file_path = ? AND chunk_index = 0').get(filePath) as { id: number } | undefined;
      if (row) {
        const chunkId = Number(row.id);
        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

        db.prepare('DELETE FROM vec_index WHERE chunk_id = CAST(? AS INTEGER)').run(chunkId);
        db.prepare('INSERT INTO vec_index (chunk_id, embedding) VALUES (CAST(? AS INTEGER), ?)').run(chunkId, embeddingBuffer);
      }

      // Mark as embedded
      db.prepare('UPDATE nyx_memory SET embedded = 1 WHERE id = ?').run(mem.id);
      embedded++;
    } catch (e: any) {
      console.warn(`[MEMORY-STORE] Failed to embed memory #${mem.id}:`, e.message);
      // Don't break the loop — try the next one
    }
  }

  console.log(`[MEMORY-STORE] Embedded ${embedded}/${pending.length} memories`);
  return embedded;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-text search across all memories.
 * Uses FTS5 with BM25 ranking for keyword-based recall.
 */
export function searchMemoryFTS(query: string, limit: number = 10): MemorySearchResult[] {
  ensureMemoryTables();
  const db = getVectorDb();

  // Clean query for FTS5 (escape special chars)
  const ftsQuery = query
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()))
    .map(w => `"${w}"`)
    .join(' OR ');

  if (!ftsQuery) return [];

  try {
    const results = db.prepare(`
      SELECT
        m.id, m.timestamp, m.user_message, m.nyx_response, m.topics, m.importance,
        nyx_memory_fts.rank as rank
      FROM nyx_memory_fts
      JOIN nyx_memory m ON m.id = nyx_memory_fts.rowid
      WHERE nyx_memory_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit) as MemorySearchResult[];

    return results;
  } catch (e: any) {
    console.warn('[MEMORY-STORE] FTS search failed:', e.message);
    return [];
  }
}

/**
 * Semantic search across embedded memories.
 * Uses vector similarity (KNN) for meaning-based recall.
 */
export async function searchMemoryVector(
  query: string,
  apiKey: string,
  limit: number = 5
): Promise<MemorySearchResult[]> {
  ensureMemoryTables();
  const db = getVectorDb();

  try {
    const queryEmbedding = await embedText(query, apiKey);
    const embeddingBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);

    // Search vec_index for memory entries (file_path starts with 'memory://')
    const vectorResults = db.prepare(`
      SELECT
        vi.chunk_id,
        vi.distance,
        vc.file_path,
        vc.content
      FROM vec_index vi
      JOIN vec_chunks vc ON vi.chunk_id = vc.id
      WHERE vi.embedding MATCH ?
        AND vi.k = ?
        AND vc.file_path LIKE 'memory://%'
      ORDER BY vi.distance
    `).all(embeddingBuffer, limit * 2) as Array<{
      chunk_id: number;
      distance: number;
      file_path: string;
      content: string;
    }>;

    // Map back to memory entries
    const results: MemorySearchResult[] = [];
    for (const vr of vectorResults.slice(0, limit)) {
      // Extract memory ID from file_path: "memory://conversation/123" → 123
      const memIdMatch = vr.file_path.match(/memory:\/\/conversation\/(\d+)/);
      if (!memIdMatch) continue;

      const memId = parseInt(memIdMatch[1]);
      const mem = db.prepare('SELECT * FROM nyx_memory WHERE id = ?').get(memId) as MemoryEntry | undefined;
      if (!mem) continue;

      results.push({
        id: memId,
        timestamp: mem.timestamp,
        user_message: mem.user_message,
        nyx_response: mem.nyx_response,
        topics: mem.topics,
        importance: mem.importance,
        similarity: 1 / (1 + vr.distance),
      });
    }

    return results;
  } catch (e: any) {
    console.warn('[MEMORY-STORE] Vector search failed:', e.message);
    return [];
  }
}

/**
 * Get recent memories chronologically.
 */
export function getRecentMemories(limit: number = 10): MemorySearchResult[] {
  ensureMemoryTables();
  const db = getVectorDb();

  return db.prepare(`
    SELECT id, timestamp, user_message, nyx_response, topics, importance
    FROM nyx_memory
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as MemorySearchResult[];
}

/**
 * Get important memories (importance >= threshold).
 */
export function getImportantMemories(minImportance: number = 2, limit: number = 20): MemorySearchResult[] {
  ensureMemoryTables();
  const db = getVectorDb();

  return db.prepare(`
    SELECT id, timestamp, user_message, nyx_response, topics, importance
    FROM nyx_memory
    WHERE importance >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(minImportance, limit) as MemorySearchResult[];
}

/**
 * Get total memory count.
 */
export function getMemoryCount(): number {
  ensureMemoryTables();
  const db = getVectorDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM nyx_memory').get() as { count: number };
  return row.count;
}

/**
 * Get memory statistics.
 */
export function getMemoryStats(): {
  total: number;
  embedded: number;
  unembedded: number;
  byImportance: Record<number, number>;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
} {
  ensureMemoryTables();
  const db = getVectorDb();

  const total = (db.prepare('SELECT COUNT(*) as c FROM nyx_memory').get() as any).c;
  const embedded = (db.prepare('SELECT COUNT(*) as c FROM nyx_memory WHERE embedded = 1').get() as any).c;
  const oldest = (db.prepare('SELECT MIN(timestamp) as ts FROM nyx_memory').get() as any).ts;
  const newest = (db.prepare('SELECT MAX(timestamp) as ts FROM nyx_memory').get() as any).ts;

  const importanceCounts = db.prepare(`
    SELECT importance, COUNT(*) as c FROM nyx_memory GROUP BY importance
  `).all() as Array<{ importance: number; c: number }>;

  const byImportance: Record<number, number> = {};
  for (const row of importanceCounts) {
    byImportance[row.importance] = row.c;
  }

  return {
    total,
    embedded,
    unembedded: total - embedded,
    byImportance,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Building (for Gemini prompts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build memory context for a given user query.
 * Combines FTS (keyword) and vector (semantic) search results.
 * This replaces the old lossy warm_summary compression.
 */
export async function buildMemoryContext(
  userMessage: string,
  apiKey?: string
): Promise<string> {
  let context = '';

  // 1. FTS Search — fast keyword recall
  const ftsResults = searchMemoryFTS(userMessage, 5);

  // 2. Vector Search — semantic recall (only if API key available and memories are embedded)
  let vectorResults: MemorySearchResult[] = [];
  if (apiKey) {
    try {
      vectorResults = await searchMemoryVector(userMessage, apiKey, 5);
    } catch (e) {
      // Silently fall back to FTS-only
    }
  }

  // 3. Deduplicate (same memory might appear in both FTS and vector results)
  const seenIds = new Set<number>();
  const allResults: MemorySearchResult[] = [];

  // Prioritize vector results (more semantically relevant)
  for (const r of vectorResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      allResults.push(r);
    }
  }
  for (const r of ftsResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      allResults.push(r);
    }
  }

  // 4. Also include any high-importance memories not already found
  const importantMemories = getImportantMemories(2, 5);
  for (const r of importantMemories) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      allResults.push(r);
    }
  }

  if (allResults.length === 0) return '';

  // 5. Format for prompt (max 8 memories to keep context reasonable)
  const limited = allResults.slice(0, 8);

  context += '\n## 🧠 Long-Term Memory (Past Conversations)\n';
  context += 'These are relevant past conversations NYX remembers. Reference naturally if applicable.\n\n';

  for (const mem of limited) {
    const date = new Date(mem.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const importance = mem.importance >= 2 ? ' ⭐' : '';
    const similarity = mem.similarity ? ` (${Math.round(mem.similarity * 100)}% match)` : '';

    // Truncate long messages
    const userMsg = mem.user_message.length > 200 ? mem.user_message.substring(0, 200) + '...' : mem.user_message;
    const nyxMsg = mem.nyx_response.length > 300 ? mem.nyx_response.substring(0, 300) + '...' : mem.nyx_response;

    context += `**[${date}]**${importance}${similarity}\n`;
    context += `VPK: ${userMsg}\n`;
    context += `NYX: ${nyxMsg}\n\n`;
  }

  return context;
}

/**
 * Import existing conversations from nyx_conversations.json into the memory store.
 * Run this ONCE to backfill existing conversation history.
 */
export async function importExistingConversations(conversationsFile: string): Promise<number> {
  ensureMemoryTables();

  const { readFile } = await import('fs/promises');
  const { existsSync } = await import('fs');

  if (!existsSync(conversationsFile)) {
    console.log('[MEMORY-STORE] No existing conversations file found');
    return 0;
  }

  const data = await readFile(conversationsFile, 'utf-8');
  const conversations = JSON.parse(data) as Array<{
    timestamp: string;
    role: 'user' | 'assistant';
    message: string;
  }>;

  const db = getVectorDb();
  let imported = 0;

  // Pair up user/assistant messages
  for (let i = 0; i < conversations.length - 1; i++) {
    const current = conversations[i];
    const next = conversations[i + 1];

    if (current.role === 'user' && next.role === 'assistant') {
      // Check if already imported (by timestamp)
      const existing = db.prepare(
        'SELECT id FROM nyx_memory WHERE timestamp = ? AND user_message = ?'
      ).get(current.timestamp, current.message);

      if (!existing) {
        const topics = extractTopics(current.message, next.message);
        const importance = estimateImportance(current.message, next.message);

        db.prepare(`
          INSERT INTO nyx_memory (timestamp, user_message, nyx_response, topics, importance, embedded)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(current.timestamp, current.message, next.message, topics, importance);
        imported++;
      }
      i++; // Skip the assistant message (already paired)
    }
  }

  console.log(`[MEMORY-STORE] Imported ${imported} conversation pairs from existing history`);
  return imported;
}
