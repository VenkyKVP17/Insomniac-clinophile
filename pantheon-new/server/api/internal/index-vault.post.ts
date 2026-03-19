/// <reference types="node" />
import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import type { H3Event } from 'h3';
import { indexVaultFiles, type IndexOptions } from '../../utils/vault-indexer';

/**
 * POST /api/internal/index-vault
 * Triggers vault indexing for semantic search.
 * Auth: X-Pantheon-Key
 *
 * Body:
 *   maxFiles?: number    — Limit files per run (default: 50)
 *   forceReindex?: boolean — Re-embed even unchanged files
 *   dirs?: string[]      — Specific subdirs to index (relative to vault)
 *
 * Returns: { success, result: IndexResult }
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
      statusMessage: 'GOOGLE_AI_API_KEY not configured. Embeddings unavailable.',
    });
  }

  const vaultPath = (config.vaultPath as string) || '/home/ubuntu/vp';

  const body = (await readBody<IndexOptions>(event).catch(() => ({}))) as Partial<IndexOptions>;

  const options: IndexOptions = {
    maxFiles: body.maxFiles ?? 50,
    forceReindex: body.forceReindex ?? false,
    dirs: body.dirs,
  };

  console.log(`[INDEX-VAULT] Indexing triggered with options:`, options);

  try {
    const result = await indexVaultFiles(vaultPath, googleKey, options);

    return {
      success: true,
      result,
    };
  } catch (err: any) {
    console.error('[INDEX-VAULT] Indexing failed:', err);
    throw createError({
      statusCode: 500,
      statusMessage: `Indexing failed: ${err.message}`,
    });
  }
});
