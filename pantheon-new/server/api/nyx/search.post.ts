/// <reference types="node" />
import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import type { H3Event } from 'h3';
import { semanticSearch, formatResultsForContext } from '../../utils/semantic-search';

/**
 * POST /api/nyx/search
 * Semantic search endpoint for NYX.
 * Auth: X-Pantheon-Key
 *
 * Body:
 *   query: string   — Natural language search query
 *   topK?: number   — Number of results to return (default: 5)
 *   format?: 'json' | 'context' — Response format (default: json)
 *
 * Returns: { success, results: SearchResult[] } or formatted context string
 */
export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig();
  const expectedKey = config.pantheonApiKey as string;
  const apiKey = getHeader(event, 'x-pantheon-key');

  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const googleKey = config.googleApi as string;
  if (!googleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'GOOGLE_AI_API_KEY not configured.',
    });
  }

  const body = await readBody<{ query: string; topK?: number; format?: string }>(event);

  if (!body?.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or empty "query" field in request body.',
    });
  }

  const vaultPath = (config.vaultPath as string) || '/home/ubuntu/vp';

  try {
    const results = await semanticSearch(body.query, googleKey, {
      topK: body.topK ?? 5,
      vaultPath,
    });

    if (body.format === 'context') {
      return {
        success: true,
        context: formatResultsForContext(results),
        resultCount: results.length,
      };
    }

    return {
      success: true,
      query: body.query,
      results: results.map(r => ({
        file: r.relativePath,
        content: r.content,
        score: Math.round(r.score * 100) / 100,
        similarity: Math.round(r.similarity * 100) / 100,
      })),
    };
  } catch (err: any) {
    console.error('[SEARCH-API] Search failed:', err);
    throw createError({
      statusCode: 500,
      statusMessage: `Search failed: ${err.message}`,
    });
  }
});
