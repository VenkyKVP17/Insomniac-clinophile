// server/api/intelligence/context.post.ts
import { defineEventHandler, readBody, getHeader, createError } from 'h3';
import { semanticSearch, formatResultsForContext } from '../../utils/semantic-search';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const expectedKey = config.pantheonApiKey as string;
  const apiKey = getHeader(event, 'x-pantheon-key');
  const googleAiKey = config.googleApi as string;

  // Security check
  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody(event);
  const { type, query, topK = 5 } = body;

  const vaultPath = process.env.VAULT_PATH || '/home/ubuntu/vp';

  if (type === 'vault_search') {
    try {
      console.log(`[INTELLIGENCE] Vector memory query: "${query}"`);
      const results = await semanticSearch(query, googleAiKey, { topK, vaultPath, minSimilarity: 0.35 });
      const context = formatResultsForContext(results);

      return {
        success: true,
        context: context || 'No relevant semantic memory matches found.',
        count: results.length,
        results: results.map(r => ({
          path: r.relativePath,
          score: Math.round(r.score * 100)
        }))
      };
    } catch (err: any) {
      console.error('[INTELLIGENCE] Semantic search error:', err);
      return {
        success: false,
        message: err.message
      };
    }
  }

  return {
    success: false,
    message: 'Invalid context type'
  };
});
