import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const NYX_SYSTEM_PROMPT = "Fallback Persona";

async function loadDynamicPersona() {
    try {
        const nyxMdPath = '/home/ubuntu/vp/NYX.md';
        if (existsSync(nyxMdPath)) {
            const content = readFileSync(nyxMdPath, 'utf-8');
            return content.substring(0, 100) + "... (truncated)";
        }
    } catch (e) {
        console.warn('Persona load failed:', e);
    }
    return NYX_SYSTEM_PROMPT;
}

async function getHotContext(ist) {
    let context = '\n## ⚡ HOT CONTEXT\n';
    try {
        const dateStr = ist.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        const dailyNotePath = `/home/ubuntu/vp/00-Daily_Notes/${dateStr}.md`;
        if (existsSync(dailyNotePath)) {
            const content = readFileSync(dailyNotePath, 'utf-8');
            context += `\n### Today's Daily Note (${dateStr}):\n${content}\n`;
        }
    } catch (e) {
        console.warn('Hot Context fail:', e);
    }
    return context;
}

async function getRelevantContext(userMessage) {
    const keywords = userMessage.match(/\b(\w{4,})\b/g) || [];
    if (keywords.length === 0) return 'No keywords';
    let context = '\n## 🔍 RELEVANT VAULT SNIPPETS\n';
    try {
        const searchPattern = keywords.slice(0, 3).join('|');
        const stdout = execSync(`grep -rilE "${searchPattern}" /home/ubuntu/vp --exclude-dir={.git,.nuxt,.output,node_modules} | head -n 3`).toString();
        context += stdout;
    } catch (e) {
        context += 'No matches';
    }
    return context;
}

async function runTest() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);

    console.log("--- Testing Feature 1: Dynamic Persona ---");
    console.log(await loadDynamicPersona());

    console.log("\n--- Testing Feature 6: Hot Context ---");
    console.log(await getHotContext(ist));

    console.log("\n--- Testing Feature 4: Relevant Context (RAG) ---");
    console.log(await getRelevantContext("What are my medical duties and finance status?"));
}

runTest();
