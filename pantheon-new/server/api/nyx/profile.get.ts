/// <reference types="node" />
import { defineEventHandler, createError, getHeader } from 'h3';
import type { H3Event } from 'h3';
import { getUserProfile } from '../../utils/user-profile';
import { estimateTokens } from '../../utils/context-compressor';

/**
 * GET /api/nyx/profile
 * View user profile and learned preferences
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

    try {
        const profile = await getUserProfile();

        // Calculate context sizes
        const hotMemorySize = profile.context_memory.hot
            .map(c => c.message)
            .join('\n').length;
        const warmSummarySize = profile.context_memory.warm_summary.length;
        const totalContextSize = hotMemorySize + warmSummarySize;

        return {
            version: profile.version,
            created: profile.created_at,
            updated: profile.updated_at,

            preferences: {
                communication: profile.preferences.communication,
                notifications: {
                    priority_threshold: profile.preferences.notifications.priority_threshold,
                    batch_mode: profile.preferences.notifications.batch_mode,
                    quiet_hours_count: profile.preferences.notifications.quiet_hours.length,
                    category_filters: profile.preferences.notifications.category_filters,
                },
                agents: Object.entries(profile.preferences.agents).map(([name, prefs]) => ({
                    name,
                    enabled: prefs.enabled,
                    priority_boost: prefs.priority_boost,
                    custom_rules_count: prefs.custom_rules.length,
                })),
                finance: profile.preferences.finance,
                medical: profile.preferences.medical,
            },

            learned_facts: {
                count: profile.learned_facts.length,
                by_category: profile.learned_facts.reduce((acc: Record<string, number>, fact) => {
                    acc[fact.category] = (acc[fact.category] || 0) + 1;
                    return acc;
                }, {}),
                recent: profile.learned_facts.slice(-5).map(f => ({
                    category: f.category,
                    fact: f.fact,
                    confidence: f.confidence,
                    source: f.source,
                    learned_at: f.learned_at,
                })),
            },

            context_memory: {
                hot_messages: profile.context_memory.hot.length,
                hot_size_chars: hotMemorySize,
                hot_size_tokens: estimateTokens('x'.repeat(hotMemorySize)),
                warm_summary_chars: warmSummarySize,
                warm_summary_tokens: estimateTokens('x'.repeat(warmSummarySize)),
                total_context_tokens: estimateTokens('x'.repeat(totalContextSize)),
                last_compression: profile.context_memory.last_compression,
                compression_count: profile.context_memory.compression_count,
                estimated_savings_vs_50_messages: Math.round(
                    (1 - totalContextSize / (50 * 200)) * 100 // Assume 200 chars/msg avg
                ) + '%',
            },

            behavioral_patterns: {
                interaction_frequency: profile.behavioral_patterns.interaction_frequency,
                engagement_topics: profile.behavioral_patterns.engagement_topics.slice(0, 5),
            },
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw createError({ statusCode: 500, statusMessage: `Failed to get profile: ${msg}` });
    }
});
