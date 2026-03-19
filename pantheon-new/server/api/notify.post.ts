/**
 * POST /api/notify
 * Secure internal endpoint — forwards a structured notification to Telegram.
 *
 * Required header: X-Pantheon-Key: <PANTHEON_API_KEY>
 *
 * Body schema:
 * {
 *   "pa_name": "HERMES",          // optional: which PA is sending
 *   "message": "Task complete!",   // required
 *   "action_url": "https://...",   // optional: deep-link button URL
 *   "action_label": "View Report"  // optional: button label
 * }
 */

/// <reference types="node" />
import type { H3Event } from 'h3';
import { defineEventHandler, readBody, getHeader, createError } from 'h3';
import { sendTelegramMessage } from '../utils/telegram';

export default defineEventHandler(async (event: H3Event) => {
    // ── Security: require API key ────────────────────────────────────────────────
    const apiKey = getHeader(event, 'x-pantheon-key');
    const expectedKey = (process as NodeJS.Process).env.PANTHEON_API_KEY;

    if (!expectedKey) {
        throw createError({ statusCode: 500, statusMessage: 'Server misconfigured: PANTHEON_API_KEY not set.' });
    }

    if (!apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Missing or invalid X-Pantheon-Key header.' });
    }

    // ── Parse body ───────────────────────────────────────────────────────────────
    const body = await readBody<{
        message: string;
        pa_name?: string;
        action_url?: string;
        action_label?: string;
    }>(event);

    if (!body?.message?.trim()) {
        throw createError({ statusCode: 400, statusMessage: 'Missing required field: message' });
    }

    // ── Enqueue message instead of sending directly ───────────────────────────
    try {
        const { enqueueMessage } = await import('../utils/db');
        
        await enqueueMessage({
            message: body.message,
            pa_name: body.pa_name || 'NYX',
            priority: (body as any).priority || 1,
            category: (body as any).category || 'General',
            action_url: body.action_url,
            action_label: body.action_label,
        });

        return { success: true, message: 'Notification enqueued for dispatch.' };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[notify.post] Enqueue failed:', msg);
        throw createError({ statusCode: 500, statusMessage: `Failed to enqueue notification: ${msg}` });
    }
});
