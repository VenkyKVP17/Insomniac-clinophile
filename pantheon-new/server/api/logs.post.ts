import { logAgentAction, type AgentLog } from '../utils/db';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<AgentLog>(event);

        // Basic validation
        if (!body.pa_name || !body.trigger_type || !body.action_taken || !body.status) {
            return createError({
                statusCode: 400,
                statusMessage: 'Missing required fields: pa_name, trigger_type, action_taken, status',
            });
        }

        if (!['SUCCESS', 'FAILED', 'BLOCKED_ON_USER', 'RUNNING'].includes(body.status)) {
            return createError({
                statusCode: 400,
                statusMessage: 'Invalid status. Must be SUCCESS, FAILED, BLOCKED_ON_USER, or RUNNING',
            });
        }

        const result = await logAgentAction(body);

        return {
            success: true,
            id: result.lastID,
            message: 'Log entry created successfully'
        };
    } catch (error) {
        console.error('Failed to create agent log:', error);
        return createError({
            statusCode: 500,
            statusMessage: 'Failed to create log entry',
        });
    }
});
