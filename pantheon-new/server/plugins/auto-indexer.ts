/**
 * Auto-Indexer Scheduler — Pantheon Server
 * Automatically indexes new/modified vault files into the vector DB.
 *
 * Two triggers:
 *  1. SCHEDULED: Runs daily at 22:00 IST — indexes all files modified today
 *  2. ON-DEMAND: Exported function for webhooks to index specific changed files
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { indexVaultFiles } from '../utils/vault-indexer';
import { getChunkCount, getFileCount, setMeta, getMeta } from '../utils/vector-db';
import { enqueueMessage } from '../utils/db';

/** IST offset in ms (UTC+5:30) */
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/** Check interval: every 15 minutes */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** Target hour in IST (22:00 = 10 PM) */
const TARGET_HOUR_IST = 22;

/** Vault directories to auto-index (relative to vault root) */
const AUTO_INDEX_DIRS = [
  '00-Daily_Notes',
  '01-Inbox',
  '02-People',
  '03-Projects',
  '04-Finance',
  '06-Agent_Outputs',
  '08-Events',
];

/** Max files per auto-index run (respects Gemini free tier) */
const MAX_FILES_PER_RUN = 40;

/**
 * Get current IST date string (YYYY-MM-DD)
 */
function getISTDate(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET);
  return ist.toISOString().split('T')[0];
}

/**
 * Get current IST hour (0-23)
 */
function getISTHour(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET);
  return ist.getUTCHours();
}

export default defineNitroPlugin(() => {
  console.log('[AUTO-INDEX] Initializing auto-indexer scheduler...');

  // Check every 15 minutes if it's time to run
  setInterval(async () => {
    const hour = getISTHour();
    const today = getISTDate();
    const lastRunDate = getMeta('last_auto_index_date');

    // Run at 22:00 IST if we haven't run today
    if (hour === TARGET_HOUR_IST && lastRunDate !== today) {
      console.log(`[AUTO-INDEX] 🕙 Triggering nightly auto-index for ${today}`);

      try {
        const config = useRuntimeConfig();
        const googleKey = config.googleApi as string;
        const vaultPath = (config.vaultPath as string) || '/home/ubuntu/vp';

        if (!googleKey) {
          console.warn('[AUTO-INDEX] No GOOGLE_AI_API_KEY configured, skipping');
          return;
        }

        // Mark as running before we start (prevents double-runs)
        setMeta('last_auto_index_date', today);

        const result = await indexVaultFiles(vaultPath, googleKey, {
          maxFiles: MAX_FILES_PER_RUN,
          dirs: AUTO_INDEX_DIRS,
        });

        const chunkCount = getChunkCount();
        const fileCount = getFileCount();

        setMeta('last_auto_index_time', new Date().toISOString());
        setMeta('last_auto_index_result', JSON.stringify({
          indexed: result.indexed,
          skipped: result.skipped,
          errors: result.errors,
          duration: result.duration,
        }));

        console.log(`[AUTO-INDEX] ✓ Nightly index complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors (${result.duration}ms)`);
        console.log(`[AUTO-INDEX] 📊 Total: ${chunkCount} chunks from ${fileCount} files`);

        // Queue a status message for NYX digest if files were indexed
        if (result.indexed > 0) {
          await enqueueMessage({
            pa_name: 'HERMES',
            priority: 3,
            message: `🧠 Semantic memory updated: indexed ${result.indexed} file(s) (${chunkCount} total chunks from ${fileCount} files). ${result.errors > 0 ? `⚠️ ${result.errors} error(s)` : ''}`,
          });
        }
      } catch (err: any) {
        console.error('[AUTO-INDEX] Nightly auto-index failed:', err.message);
        setMeta('last_auto_index_error', err.message);
      }
    }
  }, CHECK_INTERVAL_MS);

  console.log(`[AUTO-INDEX] Scheduler initialized (runs daily at ${TARGET_HOUR_IST}:00 IST)`);
});
