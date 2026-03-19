import { getAgentLogs, getPendingMessages } from '../../utils/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import Groq from 'groq-sdk';

const execAsync = promisify(exec);

// Cache for AI Summary
let cachedSummary = {
    text: "Synthesizing agent activities...",
    timestamp: 0
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default defineEventHandler(async (event) => {
    try {
        const logs = await getAgentLogs(100);
        const totalTasks = logs.length;
        const failedTasks = logs.filter(l => l.status === 'FAILED').length;
        const successRate = totalTasks > 0 ? `${Math.round(((totalTasks - failedTasks) / totalTasks) * 100)}%` : '100%';

        const pending = await getPendingMessages();
        const activeAlerts = pending.filter(m => m.priority <= 1).length;

        // Read all NYX queue messages manually
        let nyxQueue = [];
        try {
            const dataFile = join(process.cwd(), 'data', 'nyx_queue.json');
            const data = await fs.readFile(dataFile, 'utf-8');
            nyxQueue = JSON.parse(data);
        } catch (e: any) { }

        const agentMap = new Map();

        // Populate with explicit queue messages first
        for (const msg of nyxQueue) {
            const name = msg.pa_name.toUpperCase();
            if (!agentMap.has(name) || new Date(msg.created_at) > new Date(agentMap.get(name)._timestamp)) {
                agentMap.set(name, {
                    id: name.toLowerCase(),
                    name: name,
                    status: msg.priority <= 1 ? 'Warning' : 'Running', // rough proxy
                    lastAction: msg.message.split('\n')[0],
                    details: msg.message,
                    _timestamp: msg.created_at
                });
            }
        }

        // Then populate with logs if newer or missing
        for (const log of logs) {
            const name = log.pa_name.toUpperCase();
            if (!agentMap.has(name) || new Date(log.timestamp) > new Date(agentMap.get(name)._timestamp || 0)) {
                let status = 'Idle';
                if (log.status === 'RUNNING') status = 'Running';
                else if (log.status === 'FAILED') status = 'Warning';

                agentMap.set(name, {
                    id: name.toLowerCase(),
                    name: name,
                    status: status,
                    lastAction: log.action_taken || 'Task completed',
                    details: log.details || log.action_taken,
                    _timestamp: log.timestamp
                });
            }
        }

        // Read agents from vp/09-Assistants
        const assistantsDir = '/home/ubuntu/vp/09-Assistants';
        let dynamicAgents: string[] = [];
        try {
            const files = await fs.readdir(assistantsDir);
            dynamicAgents = files
                .filter(f => f.endsWith('.md') && !f.startsWith('00-') && f !== 'VERSIONING_PATCHES.md')
                .map(f => f.replace('.md', '').toUpperCase());
        } catch (e: any) {
            console.error(`Failed to read assistants directory (${assistantsDir}):`, e.message);
        }

        // Ensure NYX is always first, then others alphabetically
        const allAgentNames = Array.from(new Set(['NYX', ...dynamicAgents])).sort();

        const orderedAgents = allAgentNames.map(name => {
            if (agentMap.has(name)) {
                const agent = agentMap.get(name);
                const agentResult = { ...agent };
                delete agentResult._timestamp;
                return agentResult;
            }
            return {
                id: name.toLowerCase(),
                name: name,
                status: 'Idle',
                lastAction: 'Awaiting tasks',
                details: 'No recent activity.'
            };
        });

        // --- GROQ AI SUMMARY LOGIC ---
        const now = Date.now();
        if (now - cachedSummary.timestamp > CACHE_DURATION) {
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API || '' });

                const agentStates = orderedAgents
                    .filter(a => a.lastAction !== 'Awaiting tasks')
                    .map(a => `${a.name}: ${a.lastAction}`)
                    .join('\n');

                if (agentStates) {
                    const response = await groq.chat.completions.create({
                        messages: [
                            {
                                role: 'system',
                                content: 'You are NYX, the primary Orchestrator of the Pantheon. Synthesize the following agent activities into a single, professional, high-level status summary personalized directly for VPK. Speak directly to him. Keep it under 40 words. Focus on progress and critical alerts. CRITICAL: Do NOT use any markdown formatting, asterisks, brackets, or parentheses in your output. Return only plain, natural text.'
                            },
                            {
                                role: 'user',
                                content: `Current Agent Activities:\n${agentStates}`
                            }
                        ],
                        model: 'llama-3.3-70b-versatile',
                    });

                    cachedSummary = {
                        text: response.choices[0]?.message?.content || "Nominal status maintained.",
                        timestamp: now
                    };
                }
            } catch (err: any) {
                console.error("Groq Summary Generation Failed:", err.message);
                // Fallback to previous summary if it exists, or a default message
            }
        }

        return {
            success: true,
            data: {
                stats: {
                    totalTasks,
                    activeAlerts,
                    successRate,
                    nyxSummary: cachedSummary.text
                },
                agents: orderedAgents
            }
        };
    } catch (error) {
        console.error('Failed to get dashboard stats:', error);
        return createError({
            statusCode: 500,
            statusMessage: 'Failed to retrieve dashboard stats',
        });
    }
});
