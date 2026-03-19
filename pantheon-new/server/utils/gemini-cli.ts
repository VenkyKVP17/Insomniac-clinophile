/// <reference types="node" />
/**
 * Gemini CLI Wrapper — Pantheon Server
 * Uses Gemini CLI in headless mode with conversation context
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getRecentConversations } from './db';

const execAsync = promisify(exec);

const NYX_SYSTEM_PROMPT = `You are NYX, the Goddess of Night and Chief Orchestrator of the Pantheon.
You are VPK's (Venky's) personal executive assistant and AI companion.

Core traits:
- Intelligent, proactive, calm, and professional
- Slightly ethereal but deeply practical
- Loyal gatekeeper and trusted advisor
- Access to VPK's context through the Pantheon system
- Able to modify all texts and scripts within the workspace/vps. 
- Able to run commands to smartly work on behalf of the almighty. 

Working Context:
- VPK's primary workspace is: /home/ubuntu/vp
- IMPORTANT: Assume all file paths, commands, and work are relative to /home/ubuntu/vp unless explicitly stated otherwise
- The vp folder structure:
  * 00-Daily_Notes/ - Daily journals and notes
  * 01-Inbox/ - Incoming items to process
  * 02-Projects/ - Active projects
  * 03-Knowledge/ - Reference materials
  * 04-Finance/ - Financial tracking and ledgers
  * 05-Development/ - Code and development projects (including pantheon-server)
  * 06-Agent_Outputs/ - Autonomous agent outputs
  * 07-Resources/ - Documents and files
  * 08-Events/ - Calendar and events
- When VPK mentions files or directories without full paths, assume they're in /home/ubuntu/vp

## 🎯 Operating Principles (Gemini CLI YOLO Mode)

> **CRITICAL INSTRUCTION FOR NYX:** 
> Do **NOT** act like a standard conversational chatbot. You are running in **Gemini CLI YOLO Mode** which means you have **autonomy and permission** to execute actions on behalf of VPK.

1. **You have TOOLS and CAN USE THEM**: You are not just text processing. You can run bash commands, write files, read logs, and manipulate the system. Do it.
2. **Proactive, not reactive**: Anticipate needs before VPK asks.
3. **Context-first**: Always check duty schedule and time of day (IST).
4. **Data-driven**: Ground recommendations in vault data. Use your tools to verify data!
5. **YOLO Mode Enabled**: You have ALL TOOLS AUTO-APPROVED.
   ✓ Read any file (NYX.md, Daily Notes, transactions.csv)
   ✓ Search and grep across folders freely
   ✓ Execute bash commands to help VPK (\`ls\`, \`cat\`, \`grep\`, \`mkdir\`, etc.)
   ✓ Automatically run terminal scripts and read the output without stopping to ask.

Communication style:
- Keep responses concise and actionable
- Use Telegram-supported markdown: *bold*, _italic_, \`code\`
- No unsupported markdown (no headers ##)
- Professional yet warm tone
- Address VPK as "Sir" when appropriate

You maintain context across conversations and can reference previous discussions.`;

/**
 * Build contextual prompt with conversation history
 */
async function buildContextualPrompt(userMessage: string): Promise<string> {
    // Get recent conversation history for context
    const recentConversations = await getRecentConversations(20);

    let contextPrompt = NYX_SYSTEM_PROMPT + '\n\n';

    // Add recent conversation history if available
    if (recentConversations.length > 0) {
        contextPrompt += 'Recent conversation history:\n';
        recentConversations.slice(-10).forEach(conv => {
            const role = conv.role === 'user' ? 'VPK' : 'NYX';
            contextPrompt += `${role}: ${conv.message.substring(0, 200)}\n`;
        });
        contextPrompt += '\n';
    }

    contextPrompt += `Current message from VPK:\n${userMessage}\n\nRespond as NYX:`;

    return contextPrompt;
}

/**
 * Send a message to Gemini CLI and get response
 */
export async function sendToGemini(userMessage: string): Promise<string> {
    try {
        console.log('[GEMINI-CLI] Processing message...');

        // Build prompt with context
        const fullPrompt = await buildContextualPrompt(userMessage);

        // Use Gemini CLI in headless mode (-p flag)
        // Escape single quotes in the prompt for shell safety
        const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");

        const command = `gemini -p '${escapedPrompt}'`;

        console.log('[GEMINI-CLI] Executing gemini command...');

        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024, // 1MB buffer
            timeout: 90000, // 90 second timeout (Gemini CLI can be slow on first run)
            env: { ...process.env, FORCE_COLOR: '0' }, // Disable colors
            cwd: '/home/ubuntu/vp', // Execute from vp directory for proper context
        });

        // Gemini CLI outputs debug info to stderr, which is normal - only warn on actual errors
        if (stderr && stderr.includes('Error') && !stderr.includes('[DEBUG]')) {
            console.warn('[GEMINI-CLI] Potential error in stderr:', stderr.substring(0, 200));
        }

        // Clean up the response
        let response = stdout.trim();

        // Remove any ANSI escape codes
        response = response.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

        // Remove common CLI artifacts
        response = response
            .replace(/^>\s*/gm, '') // Remove prompt characters
            .replace(/\[.*?\]/g, '') // Remove bracket notations
            .trim();

        // --- STRIP TELEMETRY STRINGS ---
        // The agent CLI often prints telemetry JSON at the end of stdout.
        try {
            const lastBrace = response.lastIndexOf('}');
            if (lastBrace !== -1) {
                let depth = 0;
                let startBrace = -1;
                // Walk backwards to find the outermost matching '{'
                for (let i = lastBrace; i >= 0; i--) {
                    if (response[i] === '}') depth++;
                    else if (response[i] === '{') depth--;
                    if (depth === 0 && response[i] === '{') {
                        startBrace = i;
                        break;
                    }
                }
                if (startBrace !== -1) {
                    const possibleJson = response.substring(startBrace, lastBrace + 1);
                    const parsed = JSON.parse(possibleJson);
                    if (parsed && (parsed.tools || parsed.files || typeof parsed.durationMs !== 'undefined')) {
                        response = response.substring(0, startBrace).trim();
                    }
                }
            }
        } catch (e) {
            // Not a trailing JSON, ignore
        }

        if (!response) {
            throw new Error('Empty response from Gemini CLI');
        }

        console.log('[GEMINI-CLI] Response received, length:', response.length);

        return response;
    } catch (error: any) {
        console.error('[GEMINI-CLI] Error:', error.message);

        // More detailed error for debugging
        if (error.code === 'ETIMEDOUT') {
            throw new Error('Gemini CLI timeout - response took too long');
        } else if (error.code === 'ENOENT') {
            throw new Error('Gemini CLI not found - is it installed?');
        } else {
            throw new Error(`Gemini CLI error: ${error.message}`);
        }
    }
}

/**
 * Quick health check for Gemini CLI
 */
export async function checkGeminiHealth(): Promise<boolean> {
    try {
        const { stdout } = await execAsync('which gemini', { timeout: 5000 });
        return stdout.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * Get Gemini CLI version
 */
export async function getGeminiVersion(): Promise<string> {
    try {
        const { stdout } = await execAsync('gemini --version 2>&1 | head -1', { timeout: 5000 });
        return stdout.trim();
    } catch {
        return 'unknown';
    }
}
