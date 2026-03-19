import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import { browse } from '../../utils/browser-agent';

/**
 * POST /api/nyx/browse
 * Headless browser endpoint — allows NYX to visit websites and extract content.
 * 
 * Auth: X-Pantheon-Key
 * Body: { url, waitSelector, timeout, blockMedia }
 */
export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const expectedKey = config.pantheonApiKey;
    const apiKey = getHeader(event, 'x-pantheon-key');

    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const body = await readBody(event);
    
    if (!body?.url) {
        throw createError({ statusCode: 400, statusMessage: 'Missing URL' });
    }

    try {
        const result = await browse({
            url: body.url,
            waitSelector: body.waitSelector,
            timeout: body.timeout,
            blockMedia: body.blockMedia
        });

        if (!result.success) {
            throw createError({ 
                statusCode: 502, 
                statusMessage: `Browser error: ${result.error}` 
            });
        }

        return result;
    } catch (error: any) {
        console.error('[browse.post] Error:', error.message);
        throw createError({ 
            statusCode: error.statusCode || 500, 
            statusMessage: error.statusMessage || error.message 
        });
    }
});
