import fs from 'fs/promises';
import path from 'path';
import { runNyxAnalysis } from './ai';
import { sendTelegramMessage } from './telegram';
import { enqueueMessage } from './db';

export interface NYXConfig {
    vaultPath: string;
    groqApiKey: string;
}

/**
 * Determine priority based on content analysis
 */
function determinePriority(insight: string, filePath: string): 0 | 1 | 2 | 3 {
    const lowerInsight = insight.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    // P0: Critical - Urgent, deadline, ASAP
    if (lowerInsight.match(/urgent|critical|asap|immediately|deadline.*today|emergency/)) {
        return 0;
    }

    // P1: High - Important, action required, tomorrow
    if (lowerInsight.match(/important|action required|needs attention|deadline.*tomorrow|high priority/)) {
        return 1;
    }

    // P2: Info - General updates, finance, events
    if (lowerPath.includes('finance') || lowerPath.includes('events') ||
        lowerInsight.match(/update|note|reminder|fyi/)) {
        return 2;
    }

    // P3: Status - Everything else
    return 3;
}

/**
 * The core Executive Brain loop.
 * Takes the list of files changed from the GitHub webhook, reads their physical content,
 * passes them to the LLM (NYX) for analysis, and queues messages with priority-based dispatch.
 *
 * Priority Levels:
 * - P0 (Critical): Sent instantly (urgent, deadline today)
 * - P1 (High): Batched, sent in next dispatch window (important, action needed)
 * - P2 (Info): Batched, sent in morning/evening digest (updates, notes)
 * - P3 (Status): Batched, sent in morning/evening digest (general status)
 *
 * @param changedFiles Array of relative file paths (e.g. ['00-Daily_Notes/Mar 01.md'])
 * @param config Nuxt Runtime configs explicitly passed down to preserve context
 */
export async function executeAgentLoop(changedFiles: string[], config: NYXConfig): Promise<void> {
    console.log(`[AGENT] Executor Loop initiated for ${changedFiles.length} files.`);

    for (const relativePath of changedFiles) {
        // 1. Filter out non-Markdown files
        if (!relativePath.endsWith('.md')) {
            console.log(`[AGENT] Skipping non-markdown file: "${relativePath}"`);
            continue;
        }

        // 2. Read the file content
        const absolutePath = path.join(config.vaultPath, relativePath);
        let content: string;
        try {
            content = await fs.readFile(absolutePath, 'utf8');
        } catch (error) {
            console.error(`[AGENT] Failed to read file ${absolutePath}:`, error);
            continue;
        }

        if (!content || content.trim().length === 0) {
            console.log(`[AGENT] Skipping empty file: ${relativePath}`);
            continue;
        }

        // 3. Pass to NYX LLM Analysis
        const noteTitle = path.basename(relativePath, '.md');
        console.log(`[AGENT] Prompting NYX analysis for: ${noteTitle}`);

        const nyxInsight = await runNyxAnalysis(noteTitle, content, config.groqApiKey);

        // 4. Act on NYX's output with priority-based queueing
        if (nyxInsight && nyxInsight !== "NO_ACTION") {
            const priority = determinePriority(nyxInsight, relativePath);

            // P0 Critical: Send immediately
            if (priority === 0) {
                const messagePayload = `🚨 *CRITICAL ALERT*\n\n${nyxInsight}\n\n_Source: ${relativePath}_`;
                await sendTelegramMessage({
                    message: messagePayload,
                    pa_name: "NYX"
                });
                console.log(`[AGENT] 🚨 P0 CRITICAL sent immediately for ${noteTitle}`);
            } else {
                // P1/P2/P3: Queue for batched dispatch
                await enqueueMessage({
                    pa_name: "NYX",
                    priority,
                    message: `${nyxInsight}\n\n_Source: ${relativePath}_`,
                });
                const priorityLabel = ['CRITICAL', 'HIGH', 'INFO', 'STATUS'][priority];
                console.log(`[AGENT] ✓ P${priority} (${priorityLabel}) queued for ${noteTitle}`);
            }
        } else {
            console.log(`[AGENT] NYX determined NO_ACTION is needed for ${noteTitle}.`);
        }
    }
    console.log(`[AGENT] Executor Loop completed.`);
}
