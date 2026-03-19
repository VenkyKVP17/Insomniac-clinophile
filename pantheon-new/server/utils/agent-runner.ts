/**
 * Agent Runner Utility
 * Executes agent scripts and returns formatted output for Telegram
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { join, basename } from 'path';
import { readdir, stat } from 'fs/promises';
import { AGENT_REGISTRY, AgentConfig } from '../config/agent-registry';
import { runNyxChat } from './ai';

const execAsync = promisify(exec);

export interface AgentResponse {
    message: string;
    pa_name: string;
    success: boolean;
    buttons?: any[];
    photo?: string; // Local path to a generated image
}

/**
 * Executes an agent by its command name
 */
export async function runAgent(commandName: string, vaultPath: string, options: { synthesize?: boolean } = {}): Promise<AgentResponse> {
    const config = AGENT_REGISTRY[commandName];
    
    if (!config) {
        return {
            message: `❌ Agent command '${commandName}' not found in registry.`,
            pa_name: 'NYX',
            success: false
        };
    }

    if (!config.script) {
        return {
            message: `⚠️ Agent ${config.name} ${config.emoji} has no script defined.`,
            pa_name: config.name,
            success: false
        };
    }

    // Split script from arguments (e.g., ".scripts/tasks.py list" -> [".scripts/tasks.py", "list"])
    const [scriptFile, ...scriptArgs] = config.script.split(' ');
    const scriptPath = join(vaultPath, scriptFile);
    const argsString = scriptArgs.join(' ');

    const agentOutputDir = join(vaultPath, '06-Agent_Outputs', config.name);
    
    // Capture start time to detect NEW files
    const startTime = Date.now();

    try {
        console.log(`[AGENT-RUNNER] Executing ${config.name}...`);
        
        const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" ${argsString}`, {
            env: { ...process.env, VAULT_PATH: vaultPath, PYTHONUNBUFFERED: '1' },
            timeout: 45000 // 45s for heavier scripts (MIDAS/PLUTUS)
        });

        if (stderr && !stdout) {
            return {
                message: `⚠️ ${config.name} ${config.emoji} Error:\n\n\`${stderr.substring(0, 500)}\``,
                pa_name: config.name,
                success: false
            };
        }

        // --- DYNAMIC BUTTON PARSING ---
        // Allow scripts to output: [BUTTON|task:done:2026-03-12_14] ✅ Mark Done
        let finalMessage = stdout.trim();
        const dynamicButtons: any[] = [];
        
        const buttonRegex = /^\s*\[BUTTON\|(.+?)\]\s*(.+)$/gm;
        let match;
        while ((match = buttonRegex.exec(finalMessage)) !== null) {
            dynamicButtons.push({ text: match[2].trim(), callback_data: match[1].trim() });
        }
        // Remove button tags from the text output
        finalMessage = finalMessage.replace(buttonRegex, '').trim() || `Agent ${config.name} ${config.emoji} completed.`;

        // --- FEATURE #1: AGENT CROSS-TALK (Negotiation Layer) ---
        let crossTalkContext = '';
        if (config.cross_talk && config.cross_talk.length > 0 && (options.synthesize || config.category === 'Finance' || config.category === 'Medical')) {
            for (const crossCmd of config.cross_talk) {
                const crossConfig = AGENT_REGISTRY[crossCmd];
                if (crossConfig && crossConfig.script) {
                    console.log(`[AGENT-RUNNER] Initiating cross-talk: ${config.name} consulting ${crossConfig.name}...`);
                    try {
                        const ctScript = join(vaultPath, crossConfig.script);
                        const { stdout: ctOut } = await execAsync(`python3 "${ctScript}"`, {
                            env: { ...process.env, VAULT_PATH: vaultPath, PYTHONUNBUFFERED: '1' },
                            timeout: 15000
                        });
                        crossTalkContext += `\n[CROSS-TALK DATA: ${crossConfig.name}]\n${ctOut.trim()}\n`;
                    } catch (e) {
                        console.warn(`[AGENT-RUNNER] Cross-talk with ${crossConfig.name} failed.`);
                    }
                }
            }
        }

        // --- FEATURE #3: AI SYNTHESIS ---
        if (options.synthesize || config.category === 'Finance' || config.category === 'Medical') {
            const synthesisPrompt = `You are NYX. I have just received a raw report from the ${config.name} agent (${config.description}). 
            
            RAW REPORT:
            """
            ${finalMessage}
            """
            ${crossTalkContext ? `\nADDITIONAL CROSS-TALK CONTEXT:\n"""\n${crossTalkContext}\n"""\n\nIntegrate this cross-talk context to provide actionable "negotiation" or advisory insights (e.g., if Midas says buy, check if Plutus says we have funds).` : ''}
            
            Synthesize this data into a conversational, professional, and intelligent brief for VPK. 
            Highlight the most important "bottom line" first. Use your ethereal yet practical tone. 
            Keep it concise enough for a Telegram message.`;

            const synthesized = await runNyxChat(synthesisPrompt);
            if (synthesized) {
                finalMessage = synthesized;
            }
        }

        // --- FEATURE #4: VISUAL INTELLIGENCE (Image Detection) ---
        let detectedPhoto: string | undefined;
        try {
            const files = await readdir(agentOutputDir);
            for (const file of files) {
                const filePath = join(agentOutputDir, file);
                const fileStat = await stat(filePath);
                
                // If file was created/modified in the last 60 seconds and is an image
                if (fileStat.mtimeMs > (startTime - 5000) && /\.(png|jpg|jpeg)$/i.test(file)) {
                    detectedPhoto = filePath;
                    console.log(`[AGENT-RUNNER] Detected new image from ${config.name}: ${file}`);
                    break; // Take the first/newest one
                }
            }
        } catch (e) {
            // Output directory might not exist yet
        }

        const mergedButtons = [...(config.buttons || []), ...dynamicButtons];

        return {
            message: finalMessage,
            pa_name: config.name,
            success: true,
            buttons: formatButtons(mergedButtons.length > 0 ? mergedButtons : undefined),
            photo: detectedPhoto
        };

    } catch (error: any) {
        console.error(`[AGENT-RUNNER] ${config.name} failed:`, error);
        return {
            message: `⚠️ ${config.name} execution failed: ${error.message}`,
            pa_name: config.name,
            success: false
        };
    }
}

function formatButtons(configButtons?: AgentConfig['buttons']) {
    if (!configButtons || configButtons.length === 0) return undefined;
    const keyboard: any[] = [];
    let row: any[] = [];
    
    configButtons.forEach((btn, index) => {
        const telegramBtn: any = { text: btn.text };
        if (btn.url) telegramBtn.url = btn.url;
        else telegramBtn.callback_data = btn.callback_data;
        row.push(telegramBtn);
        if (row.length === 2 || index === configButtons.length - 1) {
            keyboard.push(row);
            row = [];
        }
    });
    return keyboard;
}
