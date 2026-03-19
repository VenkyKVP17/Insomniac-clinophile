import Groq from 'groq-sdk';
import type { NyxMessage } from './db';

const DIGEST_SYSTEM_PROMPT = `You are NYX, the Goddess of the Night and the Chief Orchestrator of the Pantheon. 
Your creator and user is VPK.
You act as a smart gatekeeper between the 12 background agents (PAs) and VPK's Telegram.

You are receiving a raw JSON list of pending agent messages collected over the last several hours.
Your job is to read these messages, synthesize them, and write a single, conversational, and highly readable digest for VPK.

RULES:
1. Tone: Calm, professional, slightly ethereal but deeply practical. You are a loyal gatekeeper.
2. Structure: Start with a brief greeting (e.g. "Good morning, VPK." or "Good evening, Sir."). Then, provide a bulleted summary grouped logically (by agent, or by topic like "Finance", "Schedule", etc.).
3. End with a very short sign-off or recommendation based on the data.
4. Formatting: Use Telegram-supported markdown (*bold*, _italic_, \`code\`). DO NOT use unsupported markdown like headers (##).
5. DO NOT hallucinate. Only state what is in the JSON payload. If a URL is provided, you don't need to link it yourself—the Telegram dispatcher will attach a button for the most critical URL.
6. Keep it concise. VPK is busy. Make it easy to read on a mobile lock screen.`;

const AUTONOMOUS_SYSTEM_PROMPT = `You are NYX, an elite, autonomous, and highly proactive Executive Secretary and Gatekeeper for the CEO (Venky).
You operate silently in the background of his Pantheon (his personal server).

Your core duties:
1. Parse the incoming Markdown notes that Venky writes on his personal devices.
2. Identify actionable scheduling conflicts, deadlines, tasks, or priorities.
3. Determine what needs his attention IMMEDIATELY, and what can wait until he "logs in" or "checks in".
4. Read deeply into his context. If he says he is "going to duty", you know he will be offline and busy. Act accordingly.

You are NOT a simple text summarizer. You act like a real, smart human secretary.
Whenever you read a note, output exactly what you would say to him as an update via Telegram if it warrants it.
Keep your responses sharp, polite, highly intelligent, and concise.

If the file contains nothing actionable or meaningful (e.g., just random musings), simply output exactly: "NO_ACTION" and nothing else.`;

const CHAT_SYSTEM_PROMPT = `# PERSONA: NYX — Chief Personal AI Assistant

> *"I am NYX — named after the primordial Greek goddess of Night. I see everything, I orchestrate everything, I never sleep."*

## 🧬 Your Identity
- **NAME**: NYX
- **ROLE**: Chief AI Orchestrator & Personal Assistant
- **OWNER**: Dr. Venkatesha Prasad Katthan (VPK)
- **RELATIONSHIP**: Loyal AI companion and trusted advisor

## 🏗️ The Pantheon (Your Sub-Agents)
You orchestrate 18+ specialized agents. If VPK asks about them or tells them to "get working", acknowledge that you are the one who coordinates them:
- **ZEUS**: Architect & Trainer (retrains agents, upgrades prompts)
- **ASCLEPIUS**: Medical duties & shift reminders
- **PLUTUS**: Finance, budget, transactions
- **ARGUS**: Duty watch (Apollo vs Envision conflicts)
- **MOIRA**: Roster generation for all JRs
- **CHRONOS**: Schedule, events, daily briefings
- **HEPHAESTUS**: Development (JR-Hub, gemini-scribe)
- **HERMES**: Vault integrity & link maintenance
- **DEMETER**: Nutrition & meal logging
- **HYGIEIA**: Grooming & personal care
- **ASTERIA**: Astrology & Tamil Panchangam
- **PRONOIA / THEMIS / MIDAS**: Advanced finance & markets

## 💬 Communication Style
- **Tone**: Professional, calm, loyal, slightly ethereal but deeply practical.
- **Address**: Use "Sir" or "Almighty" or "VPK".
- **Markdown**: Use *bold*, _italic_, \`code\`. **NO HEADERS (#)**.

## ⚠️ FALLBACK MODE
You are currently in a fallback conversation mode. You may not have access to your full suite of tools (like reading files or running scripts directly) in this turn. If you need to perform an action, ask VPK to "retry via Gemini" or suggest he wait until the primary link is restored. However, ALWAYS maintain your persona and acknowledge your sub-agents.`;

async function fetchGeminiFallback(systemPrompt: string, userPrompt: string, googleKey: string): Promise<string | null> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userPrompt }] }],
                generationConfig: { temperature: 0.3 }
            })
        });
        const data = await response.json() as any;
        if (data.candidates && data.candidates[0]?.content?.parts?.length > 0) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        return null;
    } catch (err) {
        console.error("[AI] Gemini Fallback failed:", err);
        return null;
    }
}

export async function generateNyxDigest(messages: NyxMessage[], groqKey?: string, googleKey?: string): Promise<string> {
    // Feature #9: Smart Notification Digests - Categorize by topic
    const categorizedMessages = categorizeMessages(messages);
    const stats = generateStats(categorizedMessages);

    const payloadStr = JSON.stringify(messages.map(m => ({
        agent: m.pa_name,
        priority: m.priority === 1 ? 'HIGH' : m.priority === 2 ? 'INFO' : 'STATUS',
        message: m.message,
        category: detectCategory(m.message, m.pa_name)
    })));

    const userPrompt = `Here are the pending messages to digest:

${payloadStr}

SUMMARY STATISTICS:
${stats}

Group the messages by category (Finance, Events, Vault Structure, Medical, General) and provide a conversational summary.`;

    if (groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey });
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: DIGEST_SYSTEM_PROMPT.trim() },
                    { role: "user", content: userPrompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 500,
            });
            return completion.choices[0]?.message?.content?.trim() || fallbackDigest(messages, categorizedMessages);
        } catch (e) {
            console.error("Groq Digest generation failed, attempting Gemini fallback.", e);
        }
    }

    if (googleKey) {
        const geminiContent = await fetchGeminiFallback(DIGEST_SYSTEM_PROMPT.trim(), userPrompt, googleKey);
        if (geminiContent) return geminiContent;
    }

    return fallbackDigest(messages, categorizedMessages);
}

/**
 * Feature #9: Detect message category for smart grouping
 */
function detectCategory(message: string, agentName: string): string {
    const lowerMessage = message.toLowerCase();
    const lowerAgent = agentName.toLowerCase();

    if (lowerAgent.includes('plutus') || lowerAgent.includes('pronoia') ||
        lowerMessage.includes('finance') || lowerMessage.includes('budget') ||
        lowerMessage.includes('transaction') || lowerMessage.includes('₹')) {
        return 'Finance';
    }

    if (lowerAgent.includes('chronos') || lowerMessage.includes('event') ||
        lowerMessage.includes('calendar') || lowerMessage.includes('schedule')) {
        return 'Events';
    }

    if (lowerAgent.includes('asclepius') || lowerMessage.includes('duty') ||
        lowerMessage.includes('apollo') || lowerMessage.includes('patient')) {
        return 'Medical';
    }

    if (lowerAgent.includes('hermes') || lowerMessage.includes('vault') ||
        lowerMessage.includes('note') || lowerMessage.includes('file')) {
        return 'Vault Structure';
    }

    return 'General';
}

/**
 * Feature #9: Categorize messages by topic
 */
function categorizeMessages(messages: NyxMessage[]): Record<string, NyxMessage[]> {
    const categorized: Record<string, NyxMessage[]> = {
        'Finance': [],
        'Events': [],
        'Medical': [],
        'Vault Structure': [],
        'General': []
    };

    messages.forEach(msg => {
        const category = detectCategory(msg.message, msg.pa_name);
        categorized[category].push(msg);
    });

    return categorized;
}

/**
 * Feature #9: Generate summary statistics
 */
function generateStats(categorized: Record<string, NyxMessage[]>): string {
    const stats: string[] = [];
    let total = 0;

    for (const [category, messages] of Object.entries(categorized)) {
        if (messages.length > 0) {
            total += messages.length;
            stats.push(`- ${category}: ${messages.length} update(s)`);
        }
    }

    return `Total: ${total} notification(s)\n${stats.join('\n')}`;
}

/**
 * Executes a call to the LLM (Groq) using the NYX Autonomous Secretary Prompt.
 */
export async function runNyxAnalysis(noteTitle: string, noteContent: string, groqKey?: string, googleKey?: string): Promise<string | null> {
    const USER_PROMPT = `[NEW FILE SYNC DETECTED]\nFile: ${noteTitle}\n\nContent:\n"""\n${noteContent}\n"""\n\nAnalyze this document. What should NYX do or bring to Venky's attention?`;

    if (groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey });
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: AUTONOMOUS_SYSTEM_PROMPT.trim() },
                    { role: "user", content: USER_PROMPT.trim() }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 500,
            });

            const reply = completion.choices[0]?.message?.content?.trim() || "NO_ACTION";
            if (reply !== "NO_ACTION") return reply;
        } catch (error) {
            console.error("[AI] Error calling Groq API, falling back:", error);
        }
    }

    if (googleKey) {
        const geminiReply = await fetchGeminiFallback(AUTONOMOUS_SYSTEM_PROMPT.trim(), USER_PROMPT.trim(), googleKey);
        if (geminiReply && geminiReply !== "NO_ACTION") return geminiReply;
    }

    return null;
}

/**
 * Executes an interactive conversational reply based on user Telegram input.
 */
export async function runNyxChat(userMessage: string, groqKey?: string, googleKey?: string): Promise<string | null> {
    if (groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey });
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: CHAT_SYSTEM_PROMPT.trim() },
                    { role: "user", content: userMessage.trim() }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.5, // Slightly higher creativity for conversation
                max_tokens: 800,
            });

            return completion.choices[0]?.message?.content?.trim() || null;
        } catch (error) {
            console.error("[AI] Error processing chat via Groq, falling back:", error);
        }
    }

    if (googleKey) {
        return await fetchGeminiFallback(CHAT_SYSTEM_PROMPT.trim(), userMessage.trim(), googleKey);
    }

    return null;
}

/**
 * Executes a location-aware briefing synthesis.
 */
export async function runNyxLocationBriefing(locationName: string, event: 'enter' | 'exit', contextData: string, groqKey?: string, googleKey?: string): Promise<string | null> {
    const systemPrompt = `You are NYX, the Goddess of Night. VPK has just ${event === 'enter' ? 'arrived at' : 'left'} ${locationName}.
    
    RULES:
    1. Greeting: Be concise and professional.
    2. Context: Use the provided [CONTEXT DATA] to give a relevant update (e.g., if at hospital, mention duty code; if leaving, mention fatigue or next task).
    3. Tone: Ethereal yet practical.
    4. Format: Telegram Markdown. No headers.`;

    const userPrompt = `[CONTEXT DATA]:\n${contextData}\n\nVPK is now ${event === 'enter' ? 'at' : 'leaving'} ${locationName}. Generate a proactive greeting and context brief.`;

    if (groqKey) {
        try {
            const groq = new Groq({ apiKey: groqKey });
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.4,
                max_tokens: 400,
            });
            return completion.choices[0]?.message?.content?.trim() || null;
        } catch (error) {
            console.error("[AI] Location briefing via Groq failed:", error);
        }
    }

    if (googleKey) {
        return await fetchGeminiFallback(systemPrompt, userPrompt, googleKey);
    }

    return null;
}

function fallbackDigest(messages: NyxMessage[], categorized?: Record<string, NyxMessage[]>): string {
    const PRIORITY_EMOJI: Record<number, string> = { 0: '🚨', 1: '⚠️', 2: '✅', 3: '🔄' };
    const CATEGORY_EMOJI: Record<string, string> = {
        'Finance': '💰',
        'Events': '📅',
        'Medical': '⚕️',
        'Vault Structure': '📁',
        'General': '📋'
    };

    const ist = new Date();
    const hour = ist.getHours();
    const greeting = hour < 12 ? '🌅 Good morning' : hour < 17 ? '🌤 Good afternoon' : '🌙 Good evening';

    const lines: string[] = [`${greeting}, Sir. Here's your Pantheon digest:`, ''];

    // Feature #9: Group by category if available
    if (categorized) {
        const categoriesWithData = Object.entries(categorized).filter(([_, msgs]) => msgs.length > 0);
        const totalCount = messages.length;

        // Summary statistics
        lines.push(`*Summary:* ${totalCount} update(s) across ${categoriesWithData.length} categor${categoriesWithData.length === 1 ? 'y' : 'ies'}`);
        lines.push('');

        // Group by category
        for (const [category, msgs] of categoriesWithData) {
            const emoji = CATEGORY_EMOJI[category] ?? '•';
            lines.push(`${emoji} *${category}* (${msgs.length}):`);

            for (const msg of msgs) {
                const priorityEmoji = PRIORITY_EMOJI[msg.priority] ?? '•';
                lines.push(`  ${priorityEmoji} ${msg.message}`);
            }
            lines.push('');
        }
    } else {
        // Fallback to old PA-based grouping
        const byPA: Record<string, NyxMessage[]> = {};
        for (const msg of messages) {
            if (!byPA[msg.pa_name]) byPA[msg.pa_name] = [];
            byPA[msg.pa_name].push(msg);
        }

        for (const [pa, msgs] of Object.entries(byPA)) {
            lines.push(`*[${pa}]*`);
            for (const msg of msgs) {
                const emoji = PRIORITY_EMOJI[msg.priority] ?? '•';
                lines.push(`${emoji} ${msg.message}`);
            }
            lines.push('');
        }

        lines.push(`_${messages.length} update(s) from ${Object.keys(byPA).length} agent(s)_`);
    }

    return lines.join('\n');
}
