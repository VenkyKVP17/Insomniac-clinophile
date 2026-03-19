/**
 * NYX-Verbal Notifier - Lightweight Push Notification Engine
 * 
 * Designed to run ephemerally under strict RAM constraints (< 30MB).
 * Reads the NYX_INBOX from the vault and sends notifications via a 
 * predefined REST API (e.g., NYX-Verbal via Telegram Bot or ntfy.sh).
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// --- CONFIGURATION ---
const VAULT_DIR = process.env.VAULT_DIR || '/path/to/Obsidian/Vault/VP';
const INBOX_FILE = path.join(VAULT_DIR, 'NYX_INBOX.md');

// For NYX-Verbal (Telegram Bot):
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID';

/**
 * Sends a message via Telegram Bot API using native https (no bloated dependencies)
 */
function sendTelegramNotification(message) {
    if (!message || message.trim() === '') return Promise.resolve();

    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `🌙 *NYX Notification*\n\n${message}`,
        parse_mode: 'Markdown'
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            res.on('data', () => { }); // Consume stream to free memory
            res.on('end', resolve);
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * Main Execution Flow
 */
async function processNyxInbox() {
    try {
        if (!fs.existsSync(INBOX_FILE)) {
            console.log('No NYX_INBOX.md found. Nothing to report.');
            process.exit(0);
        }

        // Read using streams or direct read for small files
        const stats = fs.statSync(INBOX_FILE);
        if (stats.size === 0) {
            console.log('Inbox is empty. Exiting without sending.');
            process.exit(0);
        }

        const messageData = fs.readFileSync(INBOX_FILE, 'utf8');

        // Pattern check to avoid duplicate financial SMS spam in Telegram
        const financialPatterns = [
            /debited/i, /credited/i, /spent/i, /rs\.?/i, /inr/i,
            /txn/i, /a\/c/i, /account ending/i, /upi/i,
            /payment of/i, /sent to/i, /received from/i
        ];

        const isFinancialTxn = financialPatterns.some(pattern => pattern.test(messageData));

        if (isFinancialTxn) {
            console.log('Detected financial transaction data. Skipping Telegram notification to avoid duplicates.');
        } else {
            console.log(`Sending notification length: ${messageData.length} chars`);
            await sendTelegramNotification(messageData);
            console.log('NYX Notification Sent.');
        }

        // Clear inbox after processing (sent or skipped)
        fs.writeFileSync(INBOX_FILE, '', 'utf8');
        console.log('NYX Inbox Cleared.');

    } catch (err) {
        console.error('Failed to process NYX Inbox:', err);
        process.exit(1);
    }
}

// Execute
processNyxInbox();
