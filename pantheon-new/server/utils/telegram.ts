/// <reference types="node" />
/**
 * Telegram Utility — Pantheon Server
 * Sends messages (with optional inline buttons) to the configured Telegram chat.
 * Stateless: no persistent connections, no RAM overhead.
 */

const TELEGRAM_API = 'https://api.telegram.org';
import { suggestButtons } from './buttons';

export interface TelegramButton {
    text: string;
    url?: string;
    callback_data?: string;
}

export interface SendMessageOptions {
    message: string;
    /** Optional deep-link URL shown as a button below the message */
    action_url?: string;
    /** Button label (defaults to "View in Pantheon") */
    action_label?: string;
    /** Agent PA name prefix, e.g. "HERMES" */
    pa_name?: string;
    /** Optional overriding bot token */
    botToken?: string;
    /** Optional overriding chat ID */
    chatId?: string;
    /** Optional inline keyboard buttons (Track 4.1) */
    buttons?: TelegramButton[][];
}

function getEnvVar(key: string): string {
    // eslint-disable-next-line n/no-process-env
    const val = (process as NodeJS.Process).env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
}

export async function sendTelegramMessage(opts: SendMessageOptions): Promise<void> {
    const token = opts.botToken || getEnvVar('TELEGRAM_BOT_TOKEN');
    const chatId = opts.chatId || getEnvVar('USER_CHAT_ID');

    // Build header
    const header = opts.pa_name ? `🤖 *[${opts.pa_name}]* ` : '';
    const text = `${header}${opts.message}`;

    const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
    };

    // --- FEATURE #1: NEXT ACTION ENGINE (PREDICTIVE BUTTONS) ---
    let finalButtons = opts.buttons;
    if (!finalButtons || finalButtons.length === 0) {
        finalButtons = suggestButtons(opts.message, opts.pa_name);
    }

    // Attach inline keyboard buttons (Track 4.1)
    if (finalButtons && finalButtons.length > 0) {
        // Custom or Suggested button layout provided
        body.reply_markup = {
            inline_keyboard: finalButtons,
        };
    } else if (opts.action_url) {
        // Legacy single-button support
        body.reply_markup = {
            inline_keyboard: [[
                {
                    text: opts.action_label ?? '🌐 View in Pantheon',
                    url: opts.action_url,
                },
            ]],
        };
    }

    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        // Telegram sometimes rejects valid-looking markdown if the LLM generates bad offsets.
        // Auto-retry with plain text (no parse_mode) as a safety net.
        if (response.status === 400 && (err.includes('entity') || err.includes('parse'))) {
            console.warn('[telegram] Markdown parse failed, retrying as plain text...');
            const plainBody = { ...body };
            delete plainBody.parse_mode;
            const retryResp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plainBody),
            });
            if (!retryResp.ok) {
                const retryErr = await retryResp.text();
                throw new Error(`Telegram API error ${retryResp.status}: ${retryErr}`);
            }
            return;
        }
        throw new Error(`Telegram API error ${response.status}: ${err}`);
    }
}

/**
 * Get file information from Telegram
 */
export async function getTelegramFile(fileId: string, botToken?: string): Promise<{ file_path?: string }> {
    const token = botToken || getEnvVar('TELEGRAM_BOT_TOKEN');
    const response = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${fileId}`);
    
    if (!response.ok) {
        throw new Error(`Telegram getFile error: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    return data.result;
}

/**
 * Download a file from Telegram to local storage
 */
export async function downloadTelegramFile(telegramFilePath: string, localPath: string, botToken?: string): Promise<void> {
    const token = botToken || getEnvVar('TELEGRAM_BOT_TOKEN');
    const url = `${TELEGRAM_API}/file/bot${token}/${telegramFilePath}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Telegram download error: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const { writeFile, mkdir } = await import('fs/promises');
    const { dirname } = await import('path');
    
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, buffer);
}

/**
 * Send a photo to the Telegram chat
 */
export async function sendTelegramPhoto(photoPath: string, caption?: string, botToken?: string, chatId?: string): Promise<void> {
    const token = botToken || getEnvVar('TELEGRAM_BOT_TOKEN');
    const cid = chatId || getEnvVar('USER_CHAT_ID');

    const { readFile } = await import('fs/promises');
    const { FormData, Blob } = await import('formdata-node');
    const { fileTypeFromBuffer } = await import('file-type');

    const buffer = await readFile(photoPath);
    const type = await fileTypeFromBuffer(buffer);
    const blob = new Blob([buffer], { type: type?.mime || 'image/jpeg' });

    const form = new FormData();
    form.set('chat_id', cid);
    form.set('photo', blob, 'photo.jpg');
    if (caption) {
        form.set('caption', caption);
        form.set('parse_mode', 'Markdown');
    }

    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form as any,
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Telegram sendPhoto error: ${err}`);
    }
}
