/**
 * NYX Queue Status API
 * Returns current Gemini request queue statistics
 */

import { getQueueStats } from '../../utils/gemini-tmux';

export default defineEventHandler(async (event) => {
    const stats = getQueueStats();

    return {
        ok: true,
        queue: stats,
        timestamp: new Date().toISOString(),
    };
});
