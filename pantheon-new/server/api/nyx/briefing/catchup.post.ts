import { defineEventHandler, createError, getHeader } from 'h3';
import { generateCatchupBriefing } from '../../../utils/briefings';
import { sendTelegramMessage } from '../../../utils/telegram';

/**
 * POST /api/nyx/briefing/catchup
 * Generate and send post-duty catch-up briefing to VPK
 *
 * Typically called by cron at 9:05 PM IST (3:35 PM UTC)
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
    console.log('[NYX] Generating post-duty catch-up briefing...');
    const briefing = await generateCatchupBriefing();

    await sendTelegramMessage({
      pa_name: 'NYX',
      message: briefing,
      botToken: telegramToken,
      chatId: userChatId
    });

    console.log('[NYX] Catch-up briefing sent successfully');

    return {
      success: true,
      message: 'Catch-up briefing sent',
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[NYX] Catch-up briefing failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to send catch-up briefing: ${error.message}`
    });
  }
});
