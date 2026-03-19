import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Feature #3: Google Sheets Collaborative Sync
 * Interfaces with Google Sheets API for roster management.
 */

const VAULT_PATH = '/home/ubuntu/vp';
const TOKEN_FILE = join(VAULT_PATH, '.scripts/token_chronos.json');
const CREDENTIALS_FILE = join(VAULT_PATH, '.scripts/credentials.json');

async function getSheetsService() {
    try {
        const tokenContent = await readFile(TOKEN_FILE, 'utf-8');
        const credentialsContent = await readFile(CREDENTIALS_FILE, 'utf-8');
        
        const token = JSON.parse(tokenContent);
        const credentials = JSON.parse(credentialsContent);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        oAuth2Client.setCredentials(token);
        
        return google.sheets({ version: 'v4', auth: oAuth2Client });
    } catch (e) {
        console.error('[SHEETS] Failed to initialize Google Sheets service:', e);
        return null;
    }
}

/**
 * Fetch roster data from a specific sheet range
 */
export async function getSheetData(spreadsheetId: string, range: string) {
    const sheets = await getSheetsService();
    if (!sheets) return null;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return response.data.values;
    } catch (e) {
        console.error('[SHEETS] Error fetching sheet values:', e);
        return null;
    }
}

/**
 * Update a specific range in the sheet (e.g. for leave requests)
 */
export async function updateSheetData(spreadsheetId: string, range: string, values: any[][]) {
    const sheets = await getSheetsService();
    if (!sheets) return null;

    try {
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return response.data;
    } catch (e) {
        console.error('[SHEETS] Error updating sheet values:', e);
        return null;
    }
}
