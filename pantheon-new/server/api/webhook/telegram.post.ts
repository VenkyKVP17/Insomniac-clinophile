import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import { runNyxChat } from '../../utils/ai';
import { sendTelegramMessage, getTelegramFile, downloadTelegramFile, sendTelegramPhoto } from '../../utils/telegram';
import { sendToGeminiTmux, getTmuxSessionName } from '../../utils/gemini-tmux';
import { callGeminiAPI } from '../../utils/gemini-api';
import { callGroqAPI } from '../../utils/groq-api';
import { saveConversationMessage } from '../../utils/db';
import { runAgent, AgentResponse } from '../../utils/agent-runner';
import { AGENT_REGISTRY } from '../../config/agent-registry';
import { transcribeVoice } from '../../utils/voice';
import { saveMemory, embedPendingMemories } from '../../utils/memory-store';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { searchVectors } from '../../utils/vector-db';
import { embedText } from '../../utils/embeddings';

/**
 * Helper to dispatch agent response (text + optional photo)
 */
async function dispatchAgentResponse(result: AgentResponse, token: string, chatId: string) {
    if (result.photo) {
        await sendTelegramPhoto(result.photo, `🤖 *[${result.pa_name}]* ${result.message}`, token, chatId);
    } else {
        await sendTelegramMessage({
            message: result.message,
            pa_name: result.pa_name,
            botToken: token,
            chatId: chatId,
            buttons: result.buttons
        });
    }
}

export default defineEventHandler(async (event) => {
    // 0. Log Raw Payload Immediately
    const body = await readBody(event);
    console.log('[TELEGRAM] Incoming raw payload:', JSON.stringify(body));

    // 1. Verify Telegram Secret Token
    const config = useRuntimeConfig();
    const expectedSecret = config.telegramWebhookSecret as string;
    const incomingSecret = getHeader(event, 'X-Telegram-Bot-Api-Secret-Token');

    if (expectedSecret && incomingSecret !== expectedSecret) {
        console.warn(`[TELEGRAM] Unauthorized webhook attempt. Provided secret: ${incomingSecret}`);
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: Invalid Secret Token' });
    }

    // 2. Handle Callback Queries (Track 4.1 - Interactive Buttons)
    if (body && body.callback_query) {
        const callbackQuery = body.callback_query;
        const callbackChatId = callbackQuery.message?.chat?.id?.toString();
        const callbackData = callbackQuery.data;
        const callbackId = callbackQuery.id;

        const telegramToken = config.telegramBotToken as string;
        const authorizedUserId = config.userChatId as string;

        if (callbackChatId !== authorizedUserId) return { ok: true };

        // Acknowledge the callback
        await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackId,
                text: 'Processing...',
            }),
        });

        // Process asynchronously
        Promise.resolve().then(async () => {
            try {
                const [action, param, value] = callbackData?.split(':') || [];
                let response = '';

                switch (action) {
                    case 'agent':
                        const agentResult = await runAgent(param, '/home/ubuntu/vp', { synthesize: true });
                        await dispatchAgentResponse(agentResult, telegramToken, authorizedUserId);
                        break;
                    case 'task':
                        if (param === 'done') {
                            const [dateStr, lineNum] = value.split('_');
                            const { exec } = await import('child_process');
                            const { promisify } = await import('util');
                            const execAsync = promisify(exec);
                            const scriptPath = '/home/ubuntu/vp/.scripts/chronos_tasks.py';
                            try {
                                const { stdout } = await execAsync(`python3 "${scriptPath}" "done" "${dateStr}" "${lineNum}"`, {
                                    env: { ...process.env, VAULT_PATH: '/home/ubuntu/vp' }
                                });
                                await sendTelegramMessage({
                                    message: stdout.trim(),
                                    pa_name: 'CHRONOS',
                                    botToken: telegramToken,
                                    chatId: authorizedUserId
                                });
                            } catch (e: any) {
                                await sendTelegramMessage({ message: `❌ Error: ${e.message}`, pa_name: 'CHRONOS', botToken: telegramToken, chatId: authorizedUserId });
                            }
                        }
                        break;
                    case 'log':
                        if (param === 'expense') {
                            const [cat, amt] = value.split('_');
                            const { exec } = await import('child_process');
                            const { promisify } = await import('util');
                            const execAsync = promisify(exec);
                            const scriptPath = '/home/ubuntu/vp/.scripts/log_expense.py';
                            try {
                                const { stdout } = await execAsync(`python3 "${scriptPath}" "${cat}" "${amt}" "Logged via Telegram button"`, {
                                    env: { ...process.env, VAULT_PATH: '/home/ubuntu/vp' }
                                });
                                await sendTelegramMessage({
                                    message: stdout.trim(),
                                    pa_name: 'PLUTUS',
                                    botToken: telegramToken,
                                    chatId: authorizedUserId
                                });
                            } catch (e: any) {
                                await sendTelegramMessage({ message: `❌ Error: ${e.message}`, pa_name: 'PLUTUS', botToken: telegramToken, chatId: authorizedUserId });
                            }
                        }
                        break;
                    case 'view':
                        if (param === 'tasks_high' || param === 'tasks_overdue') {
                            const filter = param === 'tasks_high' ? 'high' : 'overdue';
                            const { exec } = await import('child_process');
                            const { promisify } = await import('util');
                            const execAsync = promisify(exec);
                            const scriptPath = '/home/ubuntu/vp/.scripts/aias_sentinel.py';
                            try {
                                const { stdout } = await execAsync(`python3 "${scriptPath}" "${filter}"`, {
                                    env: { ...process.env, VAULT_PATH: '/home/ubuntu/vp' }
                                });
                                await sendTelegramMessage({
                                    message: stdout.trim(),
                                    pa_name: 'AIAS',
                                    botToken: telegramToken,
                                    chatId: authorizedUserId
                                });
                            } catch (e: any) {
                                await sendTelegramMessage({ message: `❌ Error: ${e.message}`, pa_name: 'AIAS', botToken: telegramToken, chatId: authorizedUserId });
                            }
                        } else {
                            await sendTelegramMessage({ message: `👁️ Viewing: ${param}`, pa_name: 'NYX', botToken: telegramToken, chatId: authorizedUserId });
                        }
                        break;
                }
            } catch (error) {
                console.error('[TELEGRAM] Callback error:', error);
            }
        });

        return { ok: true };
    }

    if (!body || !body.message) return { ok: true };

    const chatId = body.message.chat?.id?.toString();
    const userMessage = body.message.text || body.message.caption;
    const photos = body.message.photo;
    const voice = body.message.voice;

    const authorizedUserId = config.userChatId as string;
    const telegramToken = config.telegramBotToken as string;

    if (chatId !== authorizedUserId) {
        if (chatId) await sendTelegramMessage({ message: "Unauthorized.", pa_name: "NYX", botToken: telegramToken, chatId });
        return { ok: true };
    }

    if (!userMessage && !photos && !voice) return { ok: true };

    // 3. Handle Slash Commands
    if (userMessage && userMessage.startsWith('/')) {
        const command = userMessage.split(' ')[0].toLowerCase();
        const commandKey = command.substring(1);

        Promise.resolve().then(async () => {
            try {
                if (AGENT_REGISTRY[commandKey]) {
                    const result = await runAgent(commandKey, '/home/ubuntu/vp', { synthesize: true });
                    await dispatchAgentResponse(result, telegramToken, authorizedUserId);
                } else {
                    let response = '';
                    switch (command) {
                        case '/help':
                            response = "🏛️ *Pantheon Commands*\n\n";
                            Object.entries(AGENT_REGISTRY).forEach(([k, v]) => response += `${v.emoji} /${k} — ${v.description}\n`);
                            break;
                        case '/status':
                            response = `🟢 *NYX Online*\n- Tmux: ${getTmuxSessionName()}`;
                            break;
                    }
                    if (response) await sendTelegramMessage({ message: response, pa_name: 'NYX', botToken: telegramToken, chatId: authorizedUserId });
                }
            } catch (e) { console.error(e); }
        });
        return { ok: true };
    }

    // 4. Handle Content (Text, Image, Voice)
    const groqKey = config.groqApi as string;
    const googleKey = config.googleApi as string;

    Promise.resolve().then(async () => {
        let voiceFilePath: string | undefined;
        let imageFilePath: string | undefined;
        try {
            let transcript = '';
            // Handle Voice
            if (voice) {
                const file = await getTelegramFile(voice.file_id, telegramToken);
                if (file.file_path) {
                    voiceFilePath = join('/tmp/nyx-media', `voice_${Date.now()}.ogg`);
                    await downloadTelegramFile(file.file_path, voiceFilePath, telegramToken);
                    transcript = await transcribeVoice(voiceFilePath, groqKey);
                    console.log(`[VOICE] Transcription: "${transcript}"`);
                }
            }

            // Handle Image
            if (photos && photos.length > 0) {
                const file = await getTelegramFile(photos[photos.length - 1].file_id, telegramToken);
                if (file.file_path) {
                    imageFilePath = join('/tmp/nyx-media', `photo_${Date.now()}.jpg`);
                    await downloadTelegramFile(file.file_path, imageFilePath, telegramToken);
                }
            }

            const effectiveMsg = transcript || userMessage || (imageFilePath ? '[Media]' : '');
            if (!effectiveMsg && !imageFilePath) return;

            await saveConversationMessage({ role: 'user', message: effectiveMsg, model_used: 'gemini-cli' });

            // Search vector DB for relevant context
            let contextStr = '';
            try {
                const queryEmbedding = await embedText(effectiveMsg, googleKey);
                const relevantChunks = searchVectors(queryEmbedding, 5);

                if (relevantChunks.length > 0) {
                    contextStr = '\n\n[RELEVANT CONTEXT FROM YOUR VAULT]:\n' +
                        relevantChunks.map(c => `- ${c.content.substring(0, 300)}`).join('\n');
                    console.log('[TELEGRAM] Added', relevantChunks.length, 'context chunks');
                }
            } catch (e: any) {
                console.warn('[TELEGRAM] Vector search failed:', e.message);
            }

            // Multi-Agent Dispatcher Mode for all messages (Voice or Text)
            const promptOverride = `[PANTHEON DISPATCHER MODE] VPK says: "${effectiveMsg}".
            Scan this for multiple intents (e.g. logging expenses, checking markets, medical duties, tasks).
            Immediately execute ALL necessary tools/agent scripts for every request found.
            Do not stop to ask for permission.${contextStr}

            CRITICAL: Omit all internal thought process, planning steps, and tool-use narrations (e.g. "I will search...", "I will update...") from your final response.
            Provide ONLY a single, synthesized summary of your actions and the results.
            VPK wants pure output, no "thinking" logs.`;

            // Use Groq for fast inference (Gemini CLI is hanging on file discovery)
            const reply = await callGroqAPI(promptOverride, groqKey);
            if (reply) {
                await saveConversationMessage({ role: 'assistant', message: reply, model_used: 'gemini-cli' });

                // Learn from interaction (Feature: Smart Preference Learning)
                const { learnFromInteraction, updateHotMemory } = await import('../../utils/user-profile');
                const { getRecentConversations } = await import('../../utils/db');

                try {
                    await learnFromInteraction(effectiveMsg, reply, {
                        time: new Date().toISOString()
                    });

                    // Update hot memory with recent conversations
                    const recent = await getRecentConversations(5);
                    await updateHotMemory(recent);
                } catch (e) {
                    console.warn('[LEARNING] Failed to learn from interaction:', e);
                }

                await sendTelegramMessage({ message: reply, pa_name: "NYX", botToken: telegramToken, chatId: authorizedUserId });

                // ── LONG-TERM MEMORY: Save to permanent memory store ──
                try {
                    saveMemory(effectiveMsg, reply);

                    // Embed pending memories in background (non-blocking)
                    // This generates vector embeddings for semantic search
                    if (googleKey) {
                        embedPendingMemories(googleKey, 3).catch(e =>
                            console.warn('[MEMORY] Background embedding failed:', e.message)
                        );
                    }
                } catch (memErr) {
                    console.warn('[MEMORY] Failed to save to long-term memory:', memErr);
                }
            }
        } catch (e) {
            console.error('[TELEGRAM] Error processing message:', e);
        } finally {
            // Clean up temporary files
            if (voiceFilePath) await unlink(voiceFilePath).catch(() => {});
            if (imageFilePath) await unlink(imageFilePath).catch(() => {});
        }
    });

    return { ok: true };
});
