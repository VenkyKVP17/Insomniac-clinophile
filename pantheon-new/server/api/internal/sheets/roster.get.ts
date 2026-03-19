import { defineEventHandler, createError, getHeader } from 'h3';
import { getSheetData } from '../../../utils/sheets';

/**
 * GET /api/internal/sheets/roster
 * Internal bridge for MOIRA agent to pull JR Roster from Google Sheets.
 * Auth: X-Pantheon-Key
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const expectedKey = config.pantheonApiKey as string;
  const apiKey = getHeader(event, 'x-pantheon-key');

  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  // Retrieve Roster Sheet ID from environment or config
  const spreadsheetId = process.env.ROSTER_SHEET_ID;
  const range = 'Roster!A1:Z100'; // Target range for JR Roster

  if (!spreadsheetId) {
    return { success: false, message: 'ROSTER_SHEET_ID not configured in server environment.' };
  }

  try {
    const values = await getSheetData(spreadsheetId, range);
    return {
      success: true,
      values,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[NYX] Sheets Roster fetch failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch roster from Sheets: ${error.message}`
    });
  }
});
