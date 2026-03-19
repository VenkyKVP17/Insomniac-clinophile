import { defineEventHandler, readBody, createError } from 'h3';
import { transcribeVoice } from '../../utils/voice';
import { getTelegramFile, downloadTelegramFile } from '../../utils/telegram';
import { join } from 'path';
import { unlink } from 'fs/promises';

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { file_id } = body;

    if (!file_id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing file_id' });
    }

    const config = useRuntimeConfig();
    const telegramToken = config.telegramBotToken as string;
    const groqKey = config.groqApi as string;

    let voiceFilePath: string | undefined;

    try {
        const file = await getTelegramFile(file_id, telegramToken);
        if (!file.file_path) {
            throw new Error('Could not get file path from Telegram');
        }

        voiceFilePath = join('/tmp/nyx-media', `voice_${Date.now()}.ogg`);
        await downloadTelegramFile(file.file_path, voiceFilePath, telegramToken);
        
        const transcription = await transcribeVoice(voiceFilePath, groqKey);
        
        return { transcription };
    } catch (error: any) {
        console.error('[TRANSCRIBE] Error:', error);
        throw createError({ statusCode: 500, statusMessage: error.message });
    } finally {
        if (voiceFilePath) {
            await unlink(voiceFilePath).catch(() => {});
        }
    }
});
