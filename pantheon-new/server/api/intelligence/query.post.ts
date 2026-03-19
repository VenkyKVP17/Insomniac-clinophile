import { defineEventHandler, readBody, createError } from 'h3';
import { callGroqAPI } from '../../utils/groq-api';
import { searchVectors } from '../../utils/vector-db';
import { embedText } from '../../utils/embeddings';

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const body = await readBody(event);

    const apiKey = event.node.req.headers['x-api-key'];
    if (apiKey !== config.pantheonApiKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const { query, context } = body;
    if (!query) {
        throw createError({ statusCode: 400, statusMessage: 'Query is required' });
    }

    console.log('[INTELLIGENCE-API] Query from n8n:', query);

    try {
        const googleKey = config.googleApi as string;
        const groqKey = config.groqApi as string;

        let contextStr = '';
        let chunksUsed = 0;
        try {
            const queryEmbedding = await embedText(query, googleKey);
            const relevantChunks = searchVectors(queryEmbedding, 5);

            if (relevantChunks.length > 0) {
                contextStr = '\n\n[CONTEXT FROM VAULT]:\n' + relevantChunks.map(c => '- ' + c.content.slice(0, 300)).join('\n');
                chunksUsed = relevantChunks.length;
            }
        } catch (e: any) {
            console.warn('[INTELLIGENCE-API] Vector search failed:', e.message);
        }

        if (context) {
            contextStr += '\n\n[ADDITIONAL CONTEXT]:\n' + context;
        }

        const prompt = 'VPK asks: "' + query + '". You are NYX, VPK AI assistant.' + contextStr + '\n\nBe concise and accurate.';

        const response = await callGroqAPI(prompt, groqKey);

        return {
            success: true,
            response,
            context_used: chunksUsed,
        };
    } catch (error: any) {
        throw createError({ statusCode: 500, statusMessage: error.message });
    }
});
