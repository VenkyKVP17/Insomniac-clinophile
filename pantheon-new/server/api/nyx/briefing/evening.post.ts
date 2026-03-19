import { defineEventHandler, createError, getHeader } from 'h3';
import { generateEveningSummary } from '../../../utils/briefings';
import { sendTelegramMessage } from '../../../utils/telegram';

/**
 * POST /api/nyx/briefing/evening
 * Generate and send evening summary to VPK
 *
 * Typically called by cron at 10:00 PM IST (4:30 PM UTC)
 * Auth: X-Pantheon-Key
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const expectedKey = config.pantheonApiKey as string;
  const apiKey = getHeader(event, 'x-pantheon-key');

  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const telegramToken = config.telegramBotToken as string;
  const userChatId = config.userChatId as string;

  try {
    console.log('[NYX] Generating evening summary...');
    const summary = await generateEveningSummary();

    await sendTelegramMessage({
      pa_name: 'NYX',
      message: summary,
      botToken: telegramToken,
      chatId: userChatId
    });

    console.log('[NYX] Evening summary sent successfully');

    return {
      success: true,
      message: 'Evening summary sent',
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[NYX] Evening summary failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to send evening summary: ${error.message}`
    });
  }
});
