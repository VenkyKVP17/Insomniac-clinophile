import { defineEventHandler, createError, getHeader } from 'h3';
import { checkSpendingVelocity } from '../../utils/analytics';

/**
 * POST /api/nyx/analyze-finance
 * Triggers PLUTUS predictive anomaly detection
 * 
 * Typically called by cron at 10:00 AM IST
 * Auth: X-Pantheon-Key
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const expectedKey = config.pantheonApiKey as string;
  const apiKey = getHeader(event, 'x-pantheon-key');

  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    console.log('[NYX] Running financial anomaly detection...');
    await checkSpendingVelocity();

    return {
      success: true,
      message: 'Financial analysis complete',
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[NYX] Financial analysis failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to analyze finance: ${error.message}`
    });
  }
});
