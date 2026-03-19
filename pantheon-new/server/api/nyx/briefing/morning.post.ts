import { defineEventHandler, createError, getHeader } from 'h3';
import { generateMorningBriefing } from '../../../utils/briefings';
import { sendTelegramMessage } from '../../../utils/telegram';

/**
 * POST /api/nyx/briefing/morning
 * Generate and send morning briefing to VPK
 *
 * Typically called by cron at 6:30 AM IST (1:00 AM UTC)
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
    console.log('[NYX] Generating morning briefing...');
    const briefing = await generateMorningBriefing();

    await sendTelegramMessage({
      pa_name: 'NYX',
      message: briefing,
      botToken: telegramToken,
      chatId: userChatId
    });

    console.log('[NYX] Morning briefing sent successfully');

    return {
      success: true,
      message: 'Morning briefing sent',
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[NYX] Morning briefing failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to send morning briefing: ${error.message}`
    });
  }
});
