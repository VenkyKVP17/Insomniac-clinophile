/// <reference types="node" />
import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import type { H3Event } from 'h3';
import { getPendingMessages, markMessagesAsSent } from '../../utils/db';
import { sendTelegramMessage } from '../../utils/telegram';
import { generateNyxDigest } from '../../utils/ai';

/**
 * POST /api/nyx/dispatch
 * NYX's dispatch brain — collects all pending queued messages and sends
 * a single batched Telegram digest to VPK.
 *
 * Called by a cron job or manually. Applies time-of-day windowing:
 *   🌅 06:00–07:00 IST  → Morning digest (all overnight messages)
 *   🌙 21:30–22:30 IST  → Evening digest (all daytime messages)
 *   Outside windows     → Only dispatches if `force=true` in body (for manual trigger)
 *
 * Auth: X-Pantheon-Key
 */

const PRIORITY_EMOJI: Record<number, string> = { 0: '🚨', 1: '⚠️', 2: '✅', 3: '🔄' };
const PRIORITY_LABEL: Record<number, string> = { 0: 'CRITICAL', 1: 'HIGH', 2: 'INFO', 3: 'STATUS' };

/** Returns true if current IST time falls inside a dispatch window */
function isDispatchWindow(): boolean {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    const hhmm = ist.getUTCHours() * 60 + ist.getUTCMinutes();

    const morningStart = 6 * 60;   // 06:00
    const morningEnd = 7 * 60;   // 07:00
    const eveningStart = 21 * 60 + 30; // 21:30
    const eveningEnd = 22 * 60 + 30; // 22:30

    return (hhmm >= morningStart && hhmm < morningEnd) ||
        (hhmm >= eveningStart && hhmm < eveningEnd);
}

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig();
    const expectedKey = config.pantheonApiKey as string;
    const apiKey = getHeader(event, 'x-pantheon-key');

    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const telegramToken = config.telegramBotToken as string;
    const userChatId = config.userChatId as string;

    const body = await readBody<{ force?: boolean }>(event);
    const force = body?.force === true;

    if (!force && !isDispatchWindow()) {
        return {
            success: true,
            dispatched: false,
            reason: 'Outside dispatch window. Use { force: true } to override.',
        };
    }

    // Fetch all pending P1/P2/P3 messages (P0 is always sent immediately at report time)
    const allPending = await getPendingMessages(3);

    if (allPending.length === 0) {
        return { success: true, dispatched: false, reason: 'No pending messages.' };
    }

    // Apply smart filtering based on learned preferences
    const { filterMessages } = await import('../../utils/notification-filter');
    const { toSend: pending, filtered } = await filterMessages(allPending);

    console.log(`[DISPATCH] Filtered ${filtered.length} messages based on preferences`);
    if (filtered.length > 0) {
        filtered.forEach(f => console.log(`  - ${f.message.pa_name}: ${f.reason}`));
    }

    if (pending.length === 0) {
        return {
            success: true,
            dispatched: false,
            reason: 'All messages filtered by user preferences.',
            filtered: filtered.length
        };
    }

    // Generate the digest message (using AI if configured, otherwise fallback)
    const googleKey = config.googleApi as string;
    const groqKey = config.groqApi as string;
    const digestText = await generateNyxDigest(pending, groqKey, googleKey);

    // Find first action_url to use as the button (from highest priority message)
    const firstWithUrl = pending.find(m => m.action_url);

    try {
        await sendTelegramMessage({
            pa_name: "NYX", // Hardcode to NYX for branding the digest
            message: digestText,
            action_url: firstWithUrl?.action_url ?? undefined,
            action_label: firstWithUrl?.action_label ?? '🌐 View in Pantheon',
            botToken: telegramToken,
            chatId: userChatId
        });

        // Mark all as sent
        const ids = pending.map(m => m.id as number);
        await markMessagesAsSent(ids);

        return {
            success: true,
            dispatched: true,
            count: pending.length
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw createError({ statusCode: 502, statusMessage: `Telegram dispatch failed: ${msg}` });
    }
});
