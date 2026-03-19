/**
 * Context Compression Service — v2 (Memory-Backed)
 *
 * Replaces the old lossy compression with lossless long-term memory recall.
 * Hot memory (last 5 conversations) stays verbatim.
 * Warm memory now queries the persistent memory store (FTS + vector search).
 * Cold memory includes learned facts from user profile.
 *
 * No information is ever lost — NYX remembers everything.
 */

import type { ConversationMessage } from './db';
import { getUserProfile } from './user-profile';
import { buildMemoryContext, getMemoryCount } from './memory-store';

/**
 * Build smart context for the AI prompt.
 *
 * Architecture:
 *   HOT  — Last 5 messages verbatim (from user_profile.json hot memory)
 *   WARM — FTS + vector search of all past conversations (from memory-store)
 *   COLD — Learned facts and preferences (from user_profile.json)
 */
export async function buildSmartContext(query: string, googleApiKey?: string): Promise<string> {
  const profile = await getUserProfile();
  let context = '';

  // ── 1. User Preferences (always include — tiny, ~50 tokens) ──────────
  context += `\n## User Preferences\n`;
  context += `Style: ${profile.preferences.communication.style}\n`;
  context += `Greeting: ${profile.preferences.communication.greeting ? 'Yes' : 'No'}\n`;
  context += `Emojis: ${profile.preferences.communication.emojis ? 'Yes' : 'No'}\n`;

  // ── 2. Hot Memory (last 5 conversations — verbatim) ──────────────────
  if (profile.context_memory.hot.length > 0) {
    context += `\n## Recent Conversation (Last ${profile.context_memory.hot.length} turns)\n`;
    profile.context_memory.hot.forEach(conv => {
      const role = conv.role === 'user' ? 'VPK' : 'NYX (you)';
      const preview = conv.message.length > 200 ? conv.message.substring(0, 200) + '...' : conv.message;
      context += `${role}: ${preview}\n`;
    });
  }

  // ── 3. Warm Memory (long-term recall from memory store) ──────────────
  const memoryCount = getMemoryCount();
  if (memoryCount > 0) {
    try {
      const memoryContext = await buildMemoryContext(query, googleApiKey);
      if (memoryContext) {
        context += memoryContext;
      }
    } catch (e: any) {
      console.warn('[CONTEXT] Memory recall failed, falling back to profile summary:', e.message);
      // Fallback: use old warm_summary if memory store fails
      if (profile.context_memory.warm_summary) {
        context += `\n## Conversation Summary (Earlier Context)\n`;
        context += profile.context_memory.warm_summary + '\n';
      }
    }
  } else if (profile.context_memory.warm_summary) {
    // No memories imported yet — use existing warm summary
    context += `\n## Conversation Summary (Earlier Context)\n`;
    context += profile.context_memory.warm_summary + '\n';
  }

  // ── 4. Cold Memory (learned facts — keyword-matched) ─────────────────
  const relevantFacts = getRelevantFactsForQuery(query, profile);
  if (relevantFacts.length > 0) {
    context += `\n## Learned Facts\n`;
    relevantFacts.forEach(fact => {
      context += `• ${fact.fact} (Confidence: ${Math.round(fact.confidence * 100)}%)\n`;
    });
  }

  return context;
}

/**
 * Get relevant facts from learned knowledge base.
 */
function getRelevantFactsForQuery(query: string, profile: any): any[] {
  const lowerQuery = query.toLowerCase();
  const keywords = lowerQuery.match(/\b\w{4,}\b/g) || [];

  if (keywords.length === 0 || !profile.learned_facts) return [];

  const relevant = profile.learned_facts.filter((fact: any) => {
    const lowerFact = fact.fact.toLowerCase();
    return keywords.some((keyword: string) => lowerFact.includes(keyword));
  });

  return relevant.slice(0, 5);
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate token savings between two context strings.
 */
export function calculateTokenSavings(oldContext: string, newContext: string): {
  old: number;
  new: number;
  saved: number;
  savingsPercent: number;
} {
  const oldTokens = estimateTokens(oldContext);
  const newTokens = estimateTokens(newContext);
  const saved = oldTokens - newTokens;
  const savingsPercent = oldTokens > 0 ? Math.round((saved / oldTokens) * 100) : 0;

  return { old: oldTokens, new: newTokens, saved, savingsPercent };
}

// ── Legacy exports (kept for backward compatibility) ───────────────────
// These are no longer needed but some code might still import them.

/**
 * @deprecated Use memory-store.ts instead. This is a no-op now.
 */
export async function compressOldContext(_groqKey?: string, _googleKey?: string): Promise<string | null> {
  console.log('[COMPRESS] Compression is no longer needed — memory store handles long-term recall');
  return null;
}
