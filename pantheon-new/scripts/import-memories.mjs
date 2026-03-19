/**
 * One-time migration: Import existing nyx_conversations.json into the long-term memory store.
 *
 * Run this once after deploying the new memory system:
 *   node scripts/import-memories.mjs
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import Database from 'better-sqlite3';
import { resolve } from 'path';

const DATA_DIR = resolve(process.cwd(), 'data');
const CONVERSATIONS_FILE = resolve(DATA_DIR, 'nyx_conversations.json');
const VECTOR_DB_PATH = resolve(DATA_DIR, 'pantheon_vectors.db');
const VEC_EXTENSION_PATH = resolve(process.cwd(), 'node_modules/sqlite-vec-linux-arm64/vec0');

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

function extractTopics(userMessage, nyxResponse) {
  const combined = `${userMessage} ${nyxResponse}`.toLowerCase();
  const words = combined.match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
    .join(' ');
}

function estimateImportance(userMessage) {
  const msg = userMessage.toLowerCase();
  if (/\b(remember|never forget|important|critical|emergency)\b/.test(msg)) return 3;
  if (/\b(prefer|decide|schedule|deadline|appointment|exam|payment|salary|emi)\b/.test(msg)) return 2;
  if (/\b(duty|shift|roster|project|task|remind|follow.?up|doctor|patient|finance|budget)\b/.test(msg)) return 1;
  return 0;
}

async function main() {
  console.log('=== NYX Memory Import ===\n');

  if (!existsSync(CONVERSATIONS_FILE)) {
    console.error('No conversations file found at:', CONVERSATIONS_FILE);
    process.exit(1);
  }

  // Open the vector DB
  const db = new Database(VECTOR_DB_PATH);
  db.pragma('journal_mode = WAL');

  try {
    db.loadExtension(VEC_EXTENSION_PATH);
  } catch (e) {
    console.warn('Could not load sqlite-vec extension (non-fatal for import):', e.message);
  }

  // Create memory tables
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

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS nyx_memory_ai AFTER INSERT ON nyx_memory BEGIN
      INSERT INTO nyx_memory_fts(rowid, user_message, nyx_response, topics)
      VALUES (new.id, new.user_message, new.nyx_response, new.topics);
    END;
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_nyx_memory_ts ON nyx_memory(timestamp);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_nyx_memory_importance ON nyx_memory(importance);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_nyx_memory_embedded ON nyx_memory(embedded);`);

  // Read conversations
  const data = await readFile(CONVERSATIONS_FILE, 'utf-8');
  const conversations = JSON.parse(data);

  console.log(`Found ${conversations.length} conversations in history`);

  // Check existing count
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM nyx_memory').get().c;
  console.log(`Existing memories in store: ${existingCount}`);

  const insertStmt = db.prepare(`
    INSERT INTO nyx_memory (timestamp, user_message, nyx_response, topics, importance, embedded)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  const checkStmt = db.prepare(
    'SELECT id FROM nyx_memory WHERE timestamp = ? AND user_message = ?'
  );

  let imported = 0;
  let skipped = 0;

  // Pair up user/assistant messages
  for (let i = 0; i < conversations.length - 1; i++) {
    const current = conversations[i];
    const next = conversations[i + 1];

    if (current.role === 'user' && next.role === 'assistant') {
      // Check if already imported
      const existing = checkStmt.get(current.timestamp, current.message);
      if (existing) {
        skipped++;
        i++;
        continue;
      }

      const topics = extractTopics(current.message, next.message);
      const importance = estimateImportance(current.message);

      insertStmt.run(current.timestamp, current.message, next.message, topics, importance);
      imported++;
      i++; // Skip the assistant message
    }
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM nyx_memory').get().c;

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${imported} conversation pairs`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Total memories in store: ${finalCount}`);

  db.close();
}

main().catch(console.error);
