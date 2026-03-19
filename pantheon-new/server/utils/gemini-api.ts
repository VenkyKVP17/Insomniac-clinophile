/**
 * Direct Gemini API Integration
 * Fallback when gemini CLI is slow/hanging
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        return text;
    } catch (error: any) {
        console.error('[GEMINI-API] Error:', error.message);
        throw new Error(`Gemini API error: ${error.message}`);
    }
}
