/**
 * Smart Cleanup Scheduler — Pantheon Server
 * Runs cleanup on boot and every 12 hours to prevent storage bloat.
 */
import { runSmartCleanup } from '../utils/db';

const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

export default defineNitroPlugin(() => {
    console.log('[CLEANUP] Initializing smart cleanup scheduler...');

    // Run cleanup 10s after boot (let other services init first)
    setTimeout(async () => {
        try {
            await runSmartCleanup();
        } catch (e) {
            console.error('[CLEANUP] Boot cleanup failed:', e);
        }
    }, 10_000);

    // Schedule recurring cleanup every 12 hours
    setInterval(async () => {
        try {
            await runSmartCleanup();
        } catch (e) {
            console.error('[CLEANUP] Scheduled cleanup failed:', e);
        }
    }, CLEANUP_INTERVAL_MS);

    console.log('[CLEANUP] Scheduler initialized (runs every 12h)');
});
