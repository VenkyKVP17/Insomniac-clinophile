/// <reference types="node" />
import type { H3Event } from 'h3';
import { getPendingMessages } from '../../utils/db';

/**
 * GET /api/nyx/queue
 * Returns pending (unsent) messages in the NYX queue.
 * Used by the Pantheon PWA dashboard to show backlog.
 *
 * Auth: X-Pantheon-Key
 */
export default defineEventHandler(async (event: H3Event) => {
    const apiKey = getHeader(event, 'x-pantheon-key');
    const expectedKey = (process as NodeJS.Process).env.PANTHEON_API_KEY;
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const pending = await getPendingMessages();
    return { success: true, count: pending.length, data: pending };
});
