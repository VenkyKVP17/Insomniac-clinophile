import { getAgentLogs } from '../utils/db';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit as string, 10) : 100;

    try {
        const logs = await getAgentLogs(limit);
        return {
            success: true,
            data: logs
        };
    } catch (error) {
        console.error('Failed to get agent logs:', error);
        return createError({
            statusCode: 500,
            statusMessage: 'Failed to retrieve logs from database',
        });
    }
});
