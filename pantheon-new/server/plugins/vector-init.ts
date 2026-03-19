/**
 * Vector DB Init Plugin — Pantheon Server
 * Initializes the vector database on Nitro server start.
 * Does NOT auto-index — indexing must be triggered via API.
 */

import { getVectorDb, getChunkCount, getFileCount, getMeta } from '../utils/vector-db';

export default defineNitroPlugin((nitroApp) => {
  try {
    // Initialize vector database (creates tables if needed)
    getVectorDb();

    const chunkCount = getChunkCount();
    const fileCount = getFileCount();
    const lastIndex = getMeta('last_index_time') ?? 'never';

    console.log(`[VECTOR-INIT] ✓ Vector DB ready — ${chunkCount} chunks from ${fileCount} files (last indexed: ${lastIndex})`);
  } catch (err: any) {
    console.error('[VECTOR-INIT] ✗ Failed to initialize vector DB:', err.message);
    console.error('[VECTOR-INIT] Semantic search will be unavailable. Fix the issue and restart.');
  }
});
