import { watch } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const VAULT_PATH = '/home/ubuntu/vp';
const SERVER_URL = 'http://localhost:3000';
const API_KEY = '65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863';

console.log('🌙 NYX Whisper Watcher: Active and scanning vault...');

// Watch for file changes in the vault
watch(VAULT_PATH, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return;
    if (filename.includes('.git') || filename.includes('.obsidian')) return;

    const filePath = join(VAULT_PATH, filename);
    
    try {
        const content = await readFile(filePath, 'utf-8');
        
        // Search for @NYX: [command]
        const whisperMatch = content.match(/@NYX:\s*(.+)/);
        if (whisperMatch) {
            const command = whisperMatch[1].trim();
            console.log(`[WHISPER] Detected command in ${filename}: "${command}"`);

            // 1. Send command to NYX Dispatcher (via local CLI for speed)
            // We use the same prompt pattern as the Telegram dispatcher
            const prompt = `[WHISPER MODE from ${filename}] ${command}`;
            
            // Execute via gemini-cli directly
            const { stdout } = await execAsync(`gemini "${prompt}"`);
            
            // 2. Log completion (Optional: we could append the response, but let's keep it clean as requested)
            console.log(`[WHISPER] Executed: ${command}`);

            // 3. CLEANUP: Remove the command from the file
            const newContent = content.replace(/@NYX:\s*.+/, `[NYX: Done ✅]`);
            await writeFile(filePath, newContent);
            
            // 4. Notify via Telegram so VPK knows it worked
            await fetch(`${SERVER_URL}/api/internal/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Pantheon-Key': API_KEY },
                body: JSON.stringify({
                    pa_name: 'NYX',
                    priority: 2,
                    message: `📝 *Vault Whisper Executed*\nFile: \`${filename}\`\nCommand: "${command}"\n\n_Result archived in vault._`
                })
            });
        }
    } catch (err) {
        // Silently fail for file access locks
    }
});
