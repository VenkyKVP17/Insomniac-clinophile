import { defineEventHandler, readBody, createError } from 'h3';
import { detectIntent, generateEmailPrompt } from '../../utils/intent-detector';
import {  parseAIEmailResponse, formatEmailForConfirmation, sendEmailViaN8n, isValidEmail } from '../../utils/gmail-api';
import { createEmailConfirmation, getLatestPendingAction, completePendingAction, cancelUserActions } from '../../utils/conversation-state';
import { callGroqAPI } from '../../utils/groq-api';
import { searchVectors } from '../../utils/vector-db';
import { embedText } from '../../utils/embeddings';
import { sendTelegramMessage } from '../../utils/telegram';
import { saveMemory, embedPendingMemories } from '../../utils/memory-store';

/**
 * POST /api/telegram/handle-message
 *
 * Enhanced Telegram message handler with:
 * - Intent detection (email, calendar, tasks)
 * - Smart email composition via AI
 * - Confirmation flow for outbound emails
 * - Two-way sync with Gmail
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);

  const { message, userId } = body;

  if (!message || !userId) {
    throw createError({ statusCode: 400, statusMessage: 'message and userId required' });
  }

  const userMessage = message.text || '';
  const chatId = userId;

  console.log(`[TELEGRAM-SMART] Message from ${userId}: ${userMessage}`);

  try {
    const googleKey = config.googleApi as string;
    const groqKey = config.groqApi as string;
    const n8nSendEmailUrl = 'https://n8n-nyx.katthan.online/webhook/send-email';

    // Check for confirmation responses (SEND, EDIT, CANCEL)
    const pendingAction = getLatestPendingAction(chatId, 'email_confirmation');

    if (pendingAction && /^(send|yes|confirm|ok)$/i.test(userMessage.trim())) {
      // User confirmed - send the email!
      const { draft } = pendingAction.data;

      await sendTelegramMessage({
        message: '📤 Sending email...',
        chatId,
      });

      const result = await sendEmailViaN8n(draft, n8nSendEmailUrl);

      completePendingAction(pendingAction.id);

      if (result.success) {
        // Archive sent email to memory
        await saveMemory(
          `[EMAIL SENT] To: ${draft.to}\nSubject: ${draft.subject}`,
          draft.body
        );

        await sendTelegramMessage({
          message: `✅ Email sent successfully to ${draft.to}!\n\nSubject: ${draft.subject}`,
          chatId,
          pa_name: 'NYX',
        });
      } else {
        await sendTelegramMessage({
          message: `❌ Failed to send email: ${result.error}`,
          chatId,
          pa_name: 'NYX',
        });
      }

      return { success: true, action: 'email_sent' };
    }

    if (pendingAction && /^(cancel|no|stop|abort)$/i.test(userMessage.trim())) {
      completePendingAction(pendingAction.id);

      await sendTelegramMessage({
        message: '🚫 Email cancelled. Not sent.',
        chatId,
        pa_name: 'NYX',
      });

      return { success: true, action: 'email_cancelled' };
    }

    if (pendingAction && /^edit$/i.test(userMessage.trim())) {
      await sendTelegramMessage({
        message: '✏️ Please tell me what to change in the email.',
        chatId,
        pa_name: 'NYX',
      });

      return { success: true, action: 'email_edit_requested' };
    }

    // Detect intent from user message
    const intent = detectIntent(userMessage);

    console.log(`[TELEGRAM-SMART] Detected intent: ${intent.type} (confidence: ${intent.confidence})`);

    // Handle EMAIL intent
    if (intent.type === 'email' && intent.confidence > 0.6) {
      await sendTelegramMessage({
        message: '✉️ Composing email...',
        chatId,
      });

      // Get relevant context from vector DB
      let contextStr = '';
      try {
        const queryEmbedding = await embedText(userMessage, googleKey);
        const relevantChunks = searchVectors(queryEmbedding, 3);

        if (relevantChunks.length > 0) {
          contextStr = relevantChunks.map(c => c.content.substring(0, 200)).join('\n');
        }
      } catch (e: any) {
        console.warn('[TELEGRAM-SMART] Vector search failed:', e.message);
      }

      // Generate email composition prompt
      const emailPrompt = generateEmailPrompt(intent, contextStr);

      // Use Groq to compose the email
      const aiResponse = await callGroqAPI(emailPrompt, groqKey);

      // Parse AI response into email draft
      const draft = parseAIEmailResponse(aiResponse);

      if (!draft || !isValidEmail(draft.to)) {
        await sendTelegramMessage({
          message: `⚠️ I couldn't compose a proper email from your request. Could you clarify:\n- Who should I send it to?\n- What's the subject?\n- What should the message say?`,
          chatId,
          pa_name: 'NYX',
        });

        return { success: false, error: 'Invalid email draft' };
      }

      // Create pending confirmation
      const confirmationId = createEmailConfirmation(chatId, draft, userMessage);

      // Send formatted draft for confirmation
      const confirmationMessage = formatEmailForConfirmation(draft);

      await sendTelegramMessage({
        message: confirmationMessage,
        chatId,
        pa_name: 'NYX',
        buttons: [
          [
            { text: '✅ SEND', callback_data: 'send_email' },
            { text: '✏️ EDIT', callback_data: 'edit_email' },
          ],
          [
            { text: '🚫 CANCEL', callback_data: 'cancel_email' },
          ],
        ],
      });

      // Save this interaction to memory
      saveMemory(userMessage, `Drafted email to ${draft.to}: ${draft.subject}`);

      return { success: true, action: 'email_draft_created', confirmationId };
    }

    // Handle GENERAL conversation (no specific intent)
    // Search vector DB for context
    let contextStr = '';
    try {
      const queryEmbedding = await embedText(userMessage, googleKey);
      const relevantChunks = searchVectors(queryEmbedding, 5);

      if (relevantChunks.length > 0) {
        contextStr = '\n\n[RELEVANT CONTEXT]:\n' +
          relevantChunks.map(c => `- ${c.content.substring(0, 300)}`).join('\n');
      }
    } catch (e: any) {
      console.warn('[TELEGRAM-SMART] Vector search failed:', e.message);
    }

    const prompt = `VPK asks: "${userMessage}". You are NYX, VPK's AI assistant.${contextStr}\n\nBe concise and helpful.`;

    const reply = await callGroqAPI(prompt, groqKey);

    await sendTelegramMessage({
      message: reply,
      chatId,
      pa_name: 'NYX',
    });

    // Save to memory
    saveMemory(userMessage, reply);

    // Background embed
    if (googleKey) {
      embedPendingMemories(googleKey, 3).catch(e =>
        console.warn('[MEMORY] Background embedding failed:', e.message)
      );
    }

    return { success: true, action: 'general_response' };

  } catch (error: any) {
    console.error('[TELEGRAM-SMART] Error:', error);

    await sendTelegramMessage({
      message: '❌ Sorry, I encountered an error. Please try again.',
      chatId,
    }).catch(() => {});

    throw createError({ statusCode: 500, statusMessage: error.message });
  }
});
