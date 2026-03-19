import { join } from 'path';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import Groq from 'groq-sdk';

/**
 * Transcribes a voice file using Groq's Whisper API
 */
export async function transcribeVoice(filePath: string, apiKey: string): Promise<string> {
    const groq = new Groq({ apiKey });

    try {
        console.log(`[VOICE] Transcribing file: ${filePath}`);
        
        const transcription = await groq.audio.transcriptions.create({
            file: createReadStream(filePath),
            model: "whisper-large-v3",
            prompt: "The audio is a voice note for an AI assistant named NYX from a user named VPK. VPK may mention agents like PLUTUS, CHRONOS, or MIDAS.",
            response_format: "text",
            language: "en"
        });

        return transcription as any as string;
    } catch (error: any) {
        console.error('[VOICE] Transcription failed:', error);
        throw new Error(`Voice transcription failed: ${error.message}`);
    }
}
