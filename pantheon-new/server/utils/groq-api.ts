/**
 * Groq API Integration
 * Fast LLM inference using Groq
 */

import Groq from 'groq-sdk';

export async function callGroqAPI(prompt: string, apiKey: string): Promise<string> {
    console.log('[GROQ-API] Calling Groq...');
    try {
        const groq = new Groq({ apiKey });

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.3-70b-versatile', // Fast and capable
            temperature: 0.7,
            max_tokens: 2048,
        });

        const response = chatCompletion.choices[0]?.message?.content || '';

        if (!response || response.length < 3) {
            throw new Error('Empty response from Groq');
        }

        console.log('[GROQ-API] Got response, length:', response.length);
        return response;
    } catch (error: any) {
        console.error('[GROQ-API] Error:', error.message);
        throw new Error(`Groq API error: ${error.message}`);
    }
}
