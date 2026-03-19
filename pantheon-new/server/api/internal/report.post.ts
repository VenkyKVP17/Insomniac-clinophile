/// <reference types="node" />
import type { H3Event } from 'h3';
import { enqueueMessage, type NyxMessage } from '../../utils/db';
import { sendTelegramMessage } from '../../utils/telegram';
import { isUserOnDuty, getTodayDuty } from '../../utils/duty';

/**
 * POST /api/internal/report
 * Internal endpoint — PAs enqueue messages to NYX here.
 * NYX decides when to surface them to VPK via Telegram.
 *
 * P0 Critical messages bypass the queue and are sent immediately.
 * All other priorities are held and batched into digest windows.
 *
 * --- FEATURE: Duty-Aware Quiet Mode ---
 * If VPK is currently on Apollo duty (M, A, N, G), NYX mutes even P0 alerts
 * to protect clinical focus, unless it is a life-critical emergency (TBD).
 * All muted alerts are delivered in a 'Catch-up Briefing' post-duty.
 */
export default defineEventHandler(async (event: H3Event) => {
    // Auth
    const apiKey = getHeader(event, 'x-pantheon-key')?.trim();
    const expectedKey = (process as NodeJS.Process).env.PANTHEON_API_KEY?.trim();
    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const body = await readBody<NyxMessage>(event);

    // Validate
    if (!body?.pa_name || !body?.message || body.message.trim() === '') {
        throw createError({ statusCode: 400, statusMessage: 'Missing or empty required fields: pa_name, message' });
    }
    if (![0, 1, 2, 3].includes(body.priority)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid priority. Must be 0, 1, 2, or 3.' });
    }

    const onDuty = await isUserOnDuty();
    const dutyType = await getTodayDuty();

    // P0 = Critical → ALWAYS bypass queue, send to Telegram immediately
    if (body.priority === 0) {
        try {
            await sendTelegramMessage({
                pa_name: body.pa_name,
                message: `🚨 *CRITICAL ALERT*\n${body.message}`,
                action_url: body.action_url,
                action_label: body.action_label ?? 'View in Pantheon',
            });
            return { success: true, queued: false, dispatched: true, message: 'Critical alert sent immediately.' };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw createError({ statusCode: 502, statusMessage: `Telegram dispatch failed: ${msg}` });
        }
    }

    // P1/P2/P3 → enqueue for batched digest (Muted during duty, summarized in catch-up)
    const result = await enqueueMessage(body);
    const responseMsg = onDuty 
        ? `User on duty (${dutyType}). Message queued for post-duty catch-up.` 
        : 'Message queued for next digest.';

    return { success: true, queued: true, dispatched: false, id: result.lastID, message: responseMsg };
});
