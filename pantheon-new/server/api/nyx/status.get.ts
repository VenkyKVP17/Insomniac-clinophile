import { defineEventHandler } from 'h3';
import { getConversationStats } from '../../utils/db';
import { checkGeminiHealth, getGeminiVersion } from '../../utils/gemini-cli';
import { checkTmuxHealth, getTmuxSessionName } from '../../utils/gemini-tmux';
import { getChunkCount, getFileCount, getDbSize, getMeta } from '../../utils/vector-db';

export default defineEventHandler(async (event) => {
    try {
        const conversationStats = await getConversationStats();
        const geminiHealthy = await checkGeminiHealth();
        const geminiVersion = await getGeminiVersion();
        const tmuxHealthy = await checkTmuxHealth();

        // Vector search stats
        let vectorStats = {};
        try {
            vectorStats = {
                healthy: true,
                totalChunks: getChunkCount(),
                indexedFiles: getFileCount(),
                dbSizeBytes: getDbSize(),
                dbSizeMB: Math.round(getDbSize() / 1024 / 1024 * 100) / 100,
                lastIndexTime: getMeta('last_index_time') ?? 'never',
                lastIndexCount: getMeta('last_index_count') ?? '0',
                autoIndex: {
                    lastRunDate: getMeta('last_auto_index_date') ?? 'never',
                    lastRunTime: getMeta('last_auto_index_time') ?? 'never',
                    scheduledAt: '22:00 IST',
                },
            };
        } catch (e: any) {
            vectorStats = { healthy: false, error: e.message };
        }

        return {
            status: 'operational',
            timestamp: new Date().toISOString(),
            gemini: {
                healthy: geminiHealthy,
                version: geminiVersion,
                mode: 'YOLO (auto-approve tools)',
                execution: 'tmux session',
            },
            tmux: {
                healthy: tmuxHealthy,
                sessionName: getTmuxSessionName(),
                attachCommand: `tmux attach -t ${getTmuxSessionName()}`,
            },
            conversations: conversationStats,
            vectorSearch: vectorStats,
        };
    } catch (error: any) {
        return {
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
        };
    }
});
