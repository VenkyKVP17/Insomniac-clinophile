import { defineEventHandler, readBody, createError } from 'h3';
import { callGroqAPI } from '../../utils/groq-api';
import { searchVectors } from '../../utils/vector-db';
import { embedText } from '../../utils/embeddings';
import { sendTelegramMessage } from '../../utils/telegram';

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const body = await readBody(event);

    const apiKey = event.node.req.headers['x-api-key'];
    if (apiKey !== config.pantheonApiKey) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const { message } = body;
    if (!message || !message.text || !message.chat) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid Telegram message format' });
    }

    const query = message.text;
    const chatId = message.chat.id.toString();

    console.log('[INTELLIGENCE-TELEGRAM] Query from chat', chatId, ':', query);

    try {
        const googleKey = config.googleApi as string;
        const groqKey = config.groqApi as string;

        // Search vector database for context
        let contextStr = '';
        let chunksUsed = 0;
        try {
            const queryEmbedding = await embedText(query, googleKey);
            const relevantChunks = searchVectors(queryEmbedding, 5);

            if (relevantChunks.length > 0) {
                contextStr = '\n\n[CONTEXT FROM VAULT]:\n' + relevantChunks.map(c => '- ' + c.content.slice(0, 300)).join('\n');
                chunksUsed = relevantChunks.length;
                console.log('[INTELLIGENCE-TELEGRAM] Using', chunksUsed, 'context chunks');
            }
        } catch (e: any) {
            console.warn('[INTELLIGENCE-TELEGRAM] Vector search failed:', e.message);
        }

        const prompt = 'VPK asks: "' + query + '". You are NYX, VPK AI assistant.' + contextStr + '\n\nBe concise and accurate.';

        const response = await callGroqAPI(prompt, groqKey);

        // Send reply via Telegram
        await sendTelegramMessage({
            message: response,
            chatId,
            pa_name: 'NYX'
        });

        console.log('[INTELLIGENCE-TELEGRAM] Reply sent successfully');

        return {
            success: true,
            context_used: chunksUsed,
        };
    } catch (error: any) {
        console.error('[INTELLIGENCE-TELEGRAM] Error:', error.message);

        // Send error message to user
        try {
            await sendTelegramMessage({
                message: '⚠️ Sorry, I encountered an error processing your request.',
                chatId: message.chat.id.toString()
            });
        } catch (e) {
            console.error('[INTELLIGENCE-TELEGRAM] Failed to send error message:', e);
        }

        throw createError({ statusCode: 500, statusMessage: error.message });
    }
});
