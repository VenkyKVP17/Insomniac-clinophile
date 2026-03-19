/// <reference types="node" />
import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import type { H3Event } from 'h3';
import { compressOldContext, calculateTokenSavings, estimateTokens } from '../../utils/context-compressor';
import { getRecentConversations } from '../../utils/db';
import { getUserProfile } from '../../utils/user-profile';

/**
 * POST /api/nyx/compress
 * Manually trigger context compression
 * This is also called by a cron job hourly
 *
 * Auth: X-Pantheon-Key
 */
export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig();
    const expectedKey = config.pantheonApiKey as string;
    const apiKey = getHeader(event, 'x-pantheon-key');

    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const groqKey = config.groqApi as string;
    const googleKey = config.googleApi as string;

    try {
        // Get current state before compression
        const profile = await getUserProfile();
        const beforeHotCount = profile.context_memory.hot.length;
        const beforeSummaryLength = profile.context_memory.warm_summary.length;

        // Calculate old context size
        const allConversations = await getRecentConversations(50);
        const oldContextSize = allConversations
            .map(c => c.message)
            .join('\n').length;

        // Compress
        const summary = await compressOldContext(groqKey, googleKey);

        if (!summary) {
            return {
                success: true,
                compressed: false,
                reason: 'Not enough messages to compress (need >10)',
                stats: {
                    hotMemory: beforeHotCount,
                    warmSummaryLength: beforeSummaryLength,
                    compressionCount: profile.context_memory.compression_count,
                }
            };
        }

        // Get new state
        const updatedProfile = await getUserProfile();
        const afterHotCount = updatedProfile.context_memory.hot.length;
        const afterSummaryLength = updatedProfile.context_memory.warm_summary.length;

        // Calculate new context size
        const newContextSize =
            updatedProfile.context_memory.hot.map(c => c.message).join('\n').length +
            updatedProfile.context_memory.warm_summary.length;

        const savings = calculateTokenSavings(
            'x'.repeat(oldContextSize),
            'x'.repeat(newContextSize)
        );

        return {
            success: true,
            compressed: true,
            stats: {
                before: {
                    hotMessages: beforeHotCount,
                    summaryChars: beforeSummaryLength,
                    estimatedTokens: estimateTokens('x'.repeat(oldContextSize)),
                },
                after: {
                    hotMessages: afterHotCount,
                    summaryChars: afterSummaryLength,
                    estimatedTokens: estimateTokens('x'.repeat(newContextSize)),
                },
                savings: {
                    tokens: savings.saved,
                    percent: savings.savingsPercent,
                },
                compressionCount: updatedProfile.context_memory.compression_count,
                lastCompression: updatedProfile.context_memory.last_compression,
            },
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw createError({ statusCode: 500, statusMessage: `Compression failed: ${msg}` });
    }
});
