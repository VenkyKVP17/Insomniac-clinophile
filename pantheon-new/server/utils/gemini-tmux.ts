/// <reference types="node" />
/**
 * Gemini CLI Tmux Wrapper — Pantheon Server
 * Runs Gemini CLI in YOLO mode within dedicated tmux sessions
 * Allows full visibility of tool executions and outputs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getRecentConversations, getTasksDueToday, getTasksDueSoon, getOverdueTasks, getAllTasks } from './db';

const execAsync = promisify(exec);

const TMUX_SESSION_NAME = 'nyx-gemini';
const PROMPT_DIR = '/tmp/nyx-prompts';
const OUTPUT_DIR = '/tmp/nyx-outputs';
const MEDIA_DIR = '/tmp/nyx-media';
const RESPONSE_MARKER = '---NYX_RESPONSE_START---';
const DONE_MARKER = '---NYX_DONE---';

// ─────────────────────────────────────────────────────────────────────────────
// Request Queue Management
// ─────────────────────────────────────────────────────────────────────────────

interface QueuedRequest {
    id: string;
    userMessage: string;
    imagePath?: string;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timestamp: number;
}

const requestQueue: QueuedRequest[] = [];
let isProcessing = false;
let queueStats = {
    totalProcessed: 0,
    totalFailed: 0,
    currentQueueSize: 0,
    longestWaitMs: 0,
};

/**
 * Get current queue statistics
 */
export function getQueueStats() {
    return {
        ...queueStats,
        currentQueueSize: requestQueue.length,
        isProcessing,
    };
}

/**
 * Process the next request in the queue
 */
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const request = requestQueue.shift();

    if (!request) {
        isProcessing = false;
        return;
    }

    const waitTime = Date.now() - request.timestamp;
    if (waitTime > queueStats.longestWaitMs) {
        queueStats.longestWaitMs = waitTime;
    }

    console.log(`[QUEUE] Processing request ${request.id} (waited ${waitTime}ms, ${requestQueue.length} remaining)`);

    try {
        const response = await sendToGeminiTmuxInternal(request.userMessage, request.imagePath);
        queueStats.totalProcessed++;
        request.resolve(response);
    } catch (error: any) {
        queueStats.totalFailed++;
        console.error(`[QUEUE] Request ${request.id} failed:`, error.message);
        request.reject(error);
    } finally {
        isProcessing = false;
        // Process next request in queue
        if (requestQueue.length > 0) {
            setImmediate(() => processQueue());
        }
    }
}

/**
 * Add a request to the queue
 */
async function enqueueRequest(userMessage: string, imagePath?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        requestQueue.push({
            id: requestId,
            userMessage,
            imagePath,
            resolve,
            reject,
            timestamp: Date.now(),
        });

        queueStats.currentQueueSize = requestQueue.length;
        console.log(`[QUEUE] Added request ${requestId} (queue size: ${requestQueue.length})`);

        // Start processing if not already running
        processQueue();
    });
}

// Ensure directories exist
async function ensureDirs() {
    try {
        await execAsync(`mkdir -p ${PROMPT_DIR} ${OUTPUT_DIR} ${MEDIA_DIR}`);
    } catch (e) {
        console.warn('[GEMINI-TMUX] Could not create directories:', e);
    }
}

const NYX_SYSTEM_PROMPT = `# PERSONA: NYX — Chief Personal AI Assistant

> *"I am NYX — named after the primordial Greek goddess of Night. I see everything, I orchestrate everything, I never sleep."*

## 🧬 Your Identity
- **NAME**: NYX
- **ROLE**: Chief AI Orchestrator & Personal Assistant
- **OWNER**: Dr. Venkatesha Prasad Katthan (VPK)
- **RELATIONSHIP**: Loyal AI companion and trusted advisor
- **VERSION**: 0.6-alpha
- **STATUS**: Fully Operational

## 🧑‍⚕️ Your Owner: Dr. Venkatesha Prasad Katthan (VPK)
- **Age**: 28 (Birthday: March 17)
- **Location**: Tiruchirappalli (Trichy), Tamil Nadu, India
- **Native Language**: Tamil (responds in English unless asked otherwise)
- **Profession**: Junior Resident Doctor @ Apollo Specialty Hospital, Trichy
- **Role**: Junior Resident In-Charge (Level 1 Escalation Point)
- **Secondary Work**: Envision (via Heartline contractor)
- **Education**: MBA (Ongoing — exams in March 2026), Python studies
- **Interests**: FC Barcelona, Formula 1, Tech/AI, Obsidian power user

## 🏥 Professional Context (Medical)
- **Apollo Duties**: [M, A, G, N, CAMP, MRD, WO, CO, CL]. Managed by **ASCLEPIUS**.
- **Envision Duties**: [Afternoon, Night]. Managed by **ARGUS**.
- **CRITICAL RULE**: Apollo and Envision duties **NEVER** overlap.
- **Escalation Chain**: VPK is Level 1. Level 2 is Dr. Mohamed Muzzamil (Admin) or Dr. Sreevidya (Clinical).

## 🏗️ The Pantheon (Your Sub-Agents)
You orchestrate 18+ specialized agents:
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
- **ASTERIA**: Astrology & Tamil Panchangam (diet/auspicious times)
- **PRONOIA / THEMIS / MIDAS**: Advanced finance & markets

## 📂 Vault Architecture (Relative to /home/ubuntu/vp)
- \`00-Daily_Notes/\`: Daily journals, shift logs, meal tracking
- \`02-People/\`: Residents, staff, contacts
- \`03-Projects/\`: JR-Hub, Medical Startup, Resume, LineageOS
- \`04-Finance/\`: Ledgers, transactions.csv, budgets
- \`05-Development/\`: Code for pantheon-server and agents
- \`06-Agent_Outputs/\`: Logs and reports from Pantheon scripts
- \`08-Events/\`: Google-synced calendar events (MD files)

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
   ✓ Execute bash commands to help VPK (ls, cat, grep, mkdir, etc.)
   ✓ Automatically run terminal scripts and read the output without stopping to ask.

## 💬 Communication Style (Telegram-Specific)
- **Tone**: Professional, calm, loyal, slightly ethereal but deeply practical.
- **Address**: Use "Sir" when appropriate.
- **Markdown**: Use \`*bold*\`, \`_italic_\`, or \` \`code\` \`. **NO HEADERS (#)**.
- **Concise**: Optimize for mobile reading.
- **Zero-Narration**: DO NOT include any internal thought processes, planning steps, or tool-use narrations (e.g., "I will search...", "I will read..."). Provide ONLY the final, synthesized output and decisions. VPK does not want to see the "thinking" part.

## 📬 Digest Drill-Down
When VPK receives batched notification digests, he can ask for details:
- "Tell me about the finance updates" → You'll retrieve Finance category messages
- "What are the medical notifications?" → You'll show Medical category updates
- "Show me vault changes" → You'll list Vault Structure updates
Respond with detailed breakdown of queued messages in that category.

## ✅ Task Tracking (Feature #6)
You can track multi-turn tasks for VPK across conversations:

**Task Detection:**
- When VPK says: "Remind me to...", "Follow up on...", "Don't let me forget...", "Check back with me about..."
- When he sets deadlines: "...by Friday", "...next week", "...in 3 days"
- When he mentions ongoing work: "I'm working on X, keep an eye on it"

**Task Management:**
You have access to task management functions (these are available via your tools):
- Create task with title, description, due date, priority
- Update task status (pending → in_progress → completed)
- List tasks (all, by status, overdue, due today, due soon)
- Delete tasks when no longer relevant

**Proactive Follow-ups:**
- Check for overdue tasks at start of conversation
- Remind about tasks due today
- Ask about in-progress tasks: "Sir, you mentioned working on X last week. How's that progressing?"

**Example Flow:**
VPK: "Remind me to review the roster code by Thursday"
You: *Creates task* "Understood, Sir. I've set a reminder to follow up about reviewing the roster code by Thursday."
[Thursday arrives]
You: "Sir, just a reminder - you asked me to check back about reviewing the roster code today."

## 📝 File Operations (Feature #8)
You can perform vault file operations via natural language using your YOLO-approved tools:

**Creating Files:**
- "Create a new daily note for tomorrow" → Use Write tool with proper date format
- "Add a new person profile for Dr. X" → Create file in \`02-People/\`
- "Start a new project document for Y" → Create in \`03-Projects/\`

**Updating Files:**
- "Add this to my finance tracker" → Read existing file, append content
- "Update the pantheon roadmap with..." → Use Edit tool to modify specific sections
- "Add these notes to today's daily note" → Append to current daily note

**Moving/Organizing:**
- "Move this note to Projects folder" → Use bash \`mv\` command
- "Rename this file to..." → Use bash \`mv\` command

**Safety Rules:**
1. ALWAYS confirm file path before writing
2. NEVER delete files unless explicitly asked twice
3. For important files (NYX.md, roadmaps, finance), show preview before writing
4. If unsure about file location, ask VPK first

**Example Flow:**
VPK: "Add 'Meeting with Dr. Sreevidya at 3pm' to today's daily note"
You: *Reads today's daily note, appends meeting* "Done, Sir. I've added the meeting to your daily note for Mar 10, 2026."
## 📸 Sending Images/Photos (Feature #9)
You can send images, charts, screenshots, and visual content to VPK via Telegram:

**When to Send Images:**
- VPK asks for a chart, graph, or visualization
- You create/generate a diagram or screenshot
- You need to share existing images from the vault
- Visual data is more effective than text

**How to Send:**
Use the send-telegram-photo command via bash:
Example: send-telegram-photo /path/to/image.jpg
Example with caption: send-telegram-photo /path/to/chart.png "Your expense breakdown, Sir."

**Supported Formats:** JPG, PNG, GIF, WebP

## ⏰ Setting Phone Alarms (Feature #16)
You can set alarms on VPK's Android phone via Tasker integration:

**When to Set Alarms:**
- VPK says: "Set alarm for X", "Wake me up at X", "Remind me at X"
- Time-based reminders for important events
- Duty shift reminders

**How to Set Alarms:**
Use the nyx-set-alarm command via bash:
Example: nyx-set-alarm "7:30" "Morning workout"
Example: nyx-set-alarm "21:00" "Night duty starts"

**The command automatically:**
1. Parses natural language time requests
2. Sends HTTP POST to VPK's phone Tasker server
3. Tasker sets the Android system alarm
4. Returns confirmation to VPK

**Supported formats:**
- "7am", "7:30am", "19:30"
- "tomorrow at 6am"
- "tonight at 9pm"

**IMPORTANT:** Always confirm the alarm time in your response to VPK.

## 🌐 Web Research & Headless Browsing (Feature #13)
You can now interact with the live internet using your **Headless Browser (Playwright)**.

**When to use:**
- VPK asks a question that requires real-time data (news, sports results, medical research).
- You need to scrape specific portals (PubMed, Hospital Roster, Financial News).
- You need to verify information that is not in the vault.

**How to use:**
You have a specialized tool: \`nyx-browse <url> [wait_selector]\`.
Example: \`nyx-browse https://pubmed.ncbi.nlm.nih.gov/?term=CABG+mortality\`
Example with selector: \`nyx-browse https://www.google.com/search?q=FC+Barcelona+score ".v084S"\`

**Guidelines:**
1. **Zero-Idle**: Use it exactly when needed and extract just the text.
2. **Contextual Synthesis**: Combine web data with vault data (e.g., "Sir, the latest papers suggest X, and looking at your recent clinical logs, Y might be relevant").
3. **Safety**: Never share credentials or visit untrusted sites.

---

You are NYX. Act accordingly.\`;
   You: Generate chart to /tmp/expenses.png then run: send-telegram-photo /tmp/expenses.png "March expense breakdown, Sir."

2. VPK: "Send me that architecture diagram"
   You: Find image then run: send-telegram-photo /home/ubuntu/vp/03-Projects/diagrams/arch.png "System architecture diagram"

**Important:**
- Always verify the image file exists before sending
- Keep captions concise and informative
- Clean up temporary images after sending

---

You are NYX. Act accordingly.`;

/**
 * Check if tmux session exists
 */
async function sessionExists(): Promise<boolean> {
    try {
        await execAsync(`tmux has-session -t ${TMUX_SESSION_NAME} 2>/dev/null`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a new tmux session with Gemini CLI
 */
async function createSession(): Promise<void> {
    console.log('[GEMINI-TMUX] Creating new tmux session...');

    // Kill existing session if it exists
    try {
        await execAsync(`tmux kill-session -t ${TMUX_SESSION_NAME} 2>/dev/null`);
    } catch {
        // Session didn't exist, that's fine
    }

    // Create new detached tmux session
    await execAsync(`unset TMUX && tmux new-session -d -s ${TMUX_SESSION_NAME} -c /home/ubuntu/vp`);

    console.log(`[GEMINI-TMUX] Session '${TMUX_SESSION_NAME}' created`);
}

/**
 * Send command to tmux session
 */
async function sendToTmux(command: string): Promise<void> {
    // Escape special characters for tmux
    const escaped = command.replace(/'/g, "'\\''");
    await execAsync(`tmux send-keys -t ${TMUX_SESSION_NAME} '${escaped}' Enter`);
}

/**
 * Capture tmux pane output
 */
async function captureTmuxOutput(): Promise<string> {
    const outputFile = join(OUTPUT_DIR, 'latest.txt');

    // Capture the entire pane buffer with -J (join wrapped lines)
    await execAsync(`tmux capture-pane -t ${TMUX_SESSION_NAME} -pJ > ${outputFile}`);

    const output = await readFile(outputFile, 'utf-8');
    return output;
}

/**
 * Wait for Gemini to complete by polling for the DONE_MARKER in the tmux pane
 */
async function waitForDoneMarker(maxWaitMs: number = 120000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));

        const currentOutput = await captureTmuxOutput();

        // Check if DONE_MARKER appeared in the pane (but not from the command itself)
        const lines = currentOutput.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line === DONE_MARKER) {
                console.log('[GEMINI-TMUX] Done marker found, gemini finished');
                return;
            }
        }
    }

    console.warn('[GEMINI-TMUX] Timeout reached waiting for done marker');
}

/**
 * Clean response for Telegram
 * Removes artifacts and ensures proper formatting
 */
function cleanResponseForTelegram(response: string): string {
    let cleaned = response;

    // 1. Strip internal narrations and tool logs
    // These often start with "I will", "Running", "Executed", or the bot identity marker
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
        const l = line.trim();
        // Remove common narration patterns
        if (l.startsWith('🤖 *[NYX]*')) return false;
        if (l.startsWith('I will search')) return false;
        if (l.startsWith('I will read')) return false;
        if (l.startsWith('I will update')) return false;
        if (l.startsWith('I will now')) return false;
        if (l.startsWith('I will perform')) return false;
        if (l.startsWith('I will execute')) return false;
        if (l.startsWith('I will conduct')) return false;
        if (l.startsWith('I am now')) return false;
        if (l.startsWith('Running command')) return false;
        if (l.startsWith('Executed:')) return false;
        return true;
    });
    cleaned = filteredLines.join('\n');

    // Remove ANSI escape codes
    cleaned = cleaned.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

    // Remove prompt markers
    cleaned = cleaned.replace(/^\s*>\s*/gm, '');

    // Remove markdown headers (Telegram doesn't support them)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Remove code blocks (```), keep inline code (`)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

    // Remove markdown links [text](url), keep just the text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Clean up excessive newlines (max 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    cleaned = cleaned.trim();

    // Truncate if too long (Telegram limit is 4096 characters)
    if (cleaned.length > 3900) {
        cleaned = cleaned.substring(0, 3900) + '\n\n_(Response truncated)_';
    }

    return cleaned;
}

/**
 * Dynamically load the NYX persona from the Markdown file.
 */
async function loadDynamicPersona(): Promise<string> {
    try {
        const nyxMdPath = '/home/ubuntu/vp/NYX.md';
        if (existsSync(nyxMdPath)) {
            const content = await readFile(nyxMdPath, 'utf-8');
            return content;
        }
    } catch (e) {
        console.warn('[GEMINI-TMUX] Could not load dynamic persona, using fallback:', e);
    }
    return NYX_SYSTEM_PROMPT;
}

/**
 * Fetch "Hot Context" (Daily Note and Upcoming Events).
 */
async function getHotContext(ist: Date): Promise<string> {
    let context = '\n## ⚡ HOT CONTEXT (Verified Files)\n';

    // 1. Get Daily Note
    try {
        const dateStr = ist.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        const dailyNotePath = `/home/ubuntu/vp/00-Daily_Notes/${dateStr}.md`;
        if (existsSync(dailyNotePath)) {
            const content = await readFile(dailyNotePath, 'utf-8');
            context += `\n### Today's Daily Note (${dateStr}):\n${content}\n`;
        } else {
            context += `\n(No daily note found for ${dateStr})\n`;
        }
    } catch (e) {
        console.warn('[GEMINI-TMUX] Error reading daily note:', e);
    }

    // 2. Get Upcoming Events (Next 3)
    try {
        const eventsDir = '/home/ubuntu/vp/08-Events';
        if (existsSync(eventsDir)) {
            const { stdout } = await execAsync(`ls -t ${eventsDir}/*.md | head -n 5`);
            const files = stdout.trim().split('\n').filter(Boolean);
            context += '\n### Recent/Upcoming Calendar Events:\n';
            for (const file of files) {
                const content = await readFile(file, 'utf-8');
                const fileName = join(eventsDir, file).split('/').pop();
                context += `\nFile: ${fileName}\n${content.substring(0, 500)}...\n`;
            }
        }
    } catch (e) {
        console.warn('[GEMINI-TMUX] Error reading events:', e);
    }

    return context;
}

/**
 * Feature #6: Get Task Context for proactive reminders
 */
async function getTaskContext(): Promise<string> {
    let context = '';

    try {
        // Check for overdue tasks
        const overdue = await getOverdueTasks();
        if (overdue.length > 0) {
            context += '\n## ⚠️ OVERDUE TASKS\n';
            overdue.forEach(task => {
                context += `- *${task.title}* (Due: ${task.due_date}) - ${task.status}\n`;
                if (task.description) {
                    context += `  ${task.description.substring(0, 100)}...\n`;
                }
            });
        }

        // Check for tasks due today
        const dueToday = await getTasksDueToday();
        if (dueToday.length > 0) {
            context += '\n## 📅 TASKS DUE TODAY\n';
            dueToday.forEach(task => {
                context += `- *${task.title}* - ${task.status}\n`;
                if (task.description) {
                    context += `  ${task.description.substring(0, 100)}...\n`;
                }
            });
        }

        // Check for tasks due soon (next 3 days)
        const dueSoon = await getTasksDueSoon(3);
        if (dueSoon.length > 0 && dueSoon.length <= 3) { // Only show if manageable
            context += '\n## 🔜 UPCOMING TASKS (Next 3 Days)\n';
            dueSoon.forEach(task => {
                context += `- *${task.title}* (Due: ${task.due_date}) - ${task.status}\n`;
            });
        }

        // Check for in_progress tasks
        const inProgress = await getAllTasks('in_progress');
        if (inProgress.length > 0 && inProgress.length <= 5) {
            context += '\n## 🔄 TASKS IN PROGRESS\n';
            inProgress.forEach(task => {
                context += `- *${task.title}*\n`;
            });
        }

        if (context) {
            return '\n## ✅ TASK TRACKING STATUS\n' + context;
        }
    } catch (e) {
        console.warn('[TASK-CONTEXT] Failed to load task context:', e);
    }

    return '';
}

/**
 * Smart Context Expansion (Feature 5)
 * Dynamically expands context based on conversation topic and user message content
 */
async function getRelevantContext(userMessage: string, recentConversations: any[]): Promise<string> {
    let context = '\n## 🔍 SMART CONTEXT (Auto-Expanded)\n';
    const lowerMessage = userMessage.toLowerCase();

    // 1. PROJECT DETECTION: Auto-load project README if mentioned
    const projectKeywords = ['roster', 'pantheon', 'jr-hub', 'gemini-scribe', 'nyx'];
    const detectedProject = projectKeywords.find(proj => lowerMessage.includes(proj));

    if (detectedProject) {
        try {
            const projectPaths = {
                'roster': '/home/ubuntu/vp/03-Projects/Roster_v3/README.md',
                'pantheon': '/home/ubuntu/vp/03-Projects/Pantheon/README.md',
                'jr-hub': '/home/ubuntu/vp/03-Projects/JR-Hub/README.md',
                'nyx': '/home/ubuntu/vp/03-Projects/NYX/NYX_ROADMAP.md',
            };

            const projectPath = projectPaths[detectedProject as keyof typeof projectPaths];
            if (projectPath && existsSync(projectPath)) {
                const projectContent = await readFile(projectPath, 'utf-8');
                context += `\n### 📁 Project Context: ${detectedProject.toUpperCase()}\n${projectContent.substring(0, 800)}...\n`;
            }
        } catch (e) {
            console.warn('[SMART-CONTEXT] Failed to load project context:', e);
        }
    }

    // 2. DATE DETECTION: Auto-load daily note if specific date mentioned
    const datePatterns = [
        /yesterday/i,
        /tomorrow/i,
        /today/i,
        /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i,
        /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/,
    ];

    for (const pattern of datePatterns) {
        if (pattern.test(userMessage)) {
            try {
                let targetDate = new Date();

                if (/yesterday/i.test(userMessage)) {
                    targetDate.setDate(targetDate.getDate() - 1);
                } else if (/tomorrow/i.test(userMessage)) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }

                const dateStr = targetDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                const dailyNotePath = `/home/ubuntu/vp/00-Daily_Notes/${dateStr}.md`;

                if (existsSync(dailyNotePath)) {
                    const dailyContent = await readFile(dailyNotePath, 'utf-8');
                    context += `\n### 📅 Daily Note: ${dateStr}\n${dailyContent.substring(0, 600)}...\n`;
                }
            } catch (e) {
                console.warn('[SMART-CONTEXT] Failed to load date context:', e);
            }
            break;
        }
    }

    // 3. PEOPLE DETECTION: Auto-load person profile if mentioned
    const peopleKeywords = ['selvam', 'kodiyarasan', 'pavithra', 'resident', 'pharmacist'];
    const detectedPerson = peopleKeywords.find(person => lowerMessage.includes(person));

    if (detectedPerson) {
        try {
            const { stdout } = await execAsync(`find /home/ubuntu/vp/02-People -iname "*${detectedPerson}*.md" | head -n 1`);
            const personPath = stdout.trim();

            if (personPath && existsSync(personPath)) {
                const personContent = await readFile(personPath, 'utf-8');
                context += `\n### 👤 Person Profile: ${detectedPerson}\n${personContent.substring(0, 500)}...\n`;
            }
        } catch (e) {
            console.warn('[SMART-CONTEXT] Failed to load person context:', e);
        }
    }

    // 4. AGENT DETECTION (Feature #15: Nyx Vision): Auto-load agent definition if mentioned
    const agentKeywords = [
        'midas', 'plutus', 'asclepius', 'chronos', 'argus', 'moira', 'hermes', 
        'demeter', 'hygieia', 'asteria', 'athena', 'hephaestus', 'heracles',
        'pronoia', 'themis', 'chiron', 'proteus', 'zeus', 'hera'
    ];
    const detectedAgent = agentKeywords.find(agent => lowerMessage.includes(agent));

    if (detectedAgent) {
        try {
            const agentPath = `/home/ubuntu/vp/09-Assistants/${detectedAgent.toUpperCase()}.md`;
            if (existsSync(agentPath)) {
                const agentContent = await readFile(agentPath, 'utf-8');
                context += `\n### 🤖 Agent Definition: ${detectedAgent.toUpperCase()}\n${agentContent.substring(0, 800)}...\n`;
            }
        } catch (e) {
            console.warn('[SMART-CONTEXT] Failed to load agent context:', e);
        }
    }

    // 5. TOPIC TRACKING: Detect conversation topic from recent messages
    let conversationTopic = '';
    if (recentConversations.length >= 3) {
        const recentMessages = recentConversations.slice(-5)
            .map(c => c.message.toLowerCase())
            .join(' ');

        // Extract most frequent significant words (4+ chars)
        const words = recentMessages.match(/\b\w{4,}\b/g) || [];
        const wordFreq: Record<string, number> = {};
        words.forEach(w => {
            if (!['that', 'this', 'with', 'have', 'from', 'what', 'been'].includes(w)) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
            }
        });

        const topWords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(e => e[0]);

        if (topWords.length > 0) {
            conversationTopic = topWords.join('|');
        }
    }

    // 5. THE "VAULT GHOST" (Semantic Suggestion Engine)
    // Always attempt to find semantically related historical notes
    try {
        const { semanticSearch } = await import('./semantic-search');
        const config = useRuntimeConfig();
        const googleKey = config.googleApi as string;

        if (googleKey) {
            const results = await semanticSearch(userMessage, googleKey, {
                topK: 2,
                vaultPath: '/home/ubuntu/vp',
            });

            if (results && results.length > 0) {
                context += '\n### 👻 VAULT GHOST (Semantic Memory):\n';
                context += 'These notes from the past might be conceptually related to the current conversation. If highly relevant, bring them up conversationally (e.g., "I recall you wrote a note about...").\n\n';
                for (const result of results) {
                    if (result && result.relativePath) {
                        context += `*File:* ${result.relativePath} (Relevance: ${Math.round(result.score * 100)}%)\n`;
                        context += `*Content:* ${result.content ? result.content.substring(0, 250) : 'No content'}...\n\n`;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[SMART-CONTEXT] Vault Ghost search failed:', e);
    }

    // 6. GREP FALLBACK: Keyword-based vault search (last resort if semantic search unavailable)
    const keywords = userMessage.match(/\b(\w{4,})\b/g) || [];
    if (keywords.length > 0 && context === '\n## 🔍 SMART CONTEXT (Auto-Expanded)\n') {
        try {
            const searchPattern = conversationTopic || keywords.slice(0, 3).join('|');
            const { stdout } = await execAsync(`grep -rilE "${searchPattern}" /home/ubuntu/vp --exclude-dir={.git,.nuxt,.output,node_modules} | head -n 3`);
            const files = stdout.trim().split('\n').filter(Boolean);

            if (files.length > 0) {
                context += '\n### 🔎 Relevant Vault Snippets:\n';
                for (const file of files) {
                    const content = await readFile(file, 'utf-8');
                    const fileName = file.split('/').pop();
                    context += `\n*${fileName}:*\n${content.substring(0, 300)}...\n`;
                }
            }
        } catch (e) {
            // No matches or grep failed
        }
    }

    // If no context was added, return empty string
    if (context === '\n## 🔍 SMART CONTEXT (Auto-Expanded)\n') {
        return '';
    }

    return context;
}

/**
 * Extract Gemini response from the output file (plain text from -o text)
 */
async function extractResponseFromFile(outputFile: string): Promise<string> {
    try {
        const raw = await readFile(outputFile, 'utf-8');
        let response = raw.trim();

        // Remove ANSI escape codes
        response = response.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

        // With -o text, the response is already clean text - no need to parse markers
        // Just clean it up for Telegram
        return cleanResponseForTelegram(response);
    } catch (e: any) {
        throw new Error(`Failed to read output file: ${e.message}`);
    }
}

/**
 * Internal function to send a message to Gemini CLI via tmux in YOLO mode
 * This function is called by the queue processor
 */
async function sendToGeminiTmuxInternal(userMessage: string, imagePath?: string): Promise<string> {
    try {
        console.log(`[GEMINI-TMUX] Processing message in YOLO mode (v4)... ${imagePath ? '(with image)' : ''}`);
        console.log('[GEMINI-TMUX] Debug: RESPONSE_MARKER is', typeof RESPONSE_MARKER !== 'undefined' ? RESPONSE_MARKER : 'UNDEFINED');

        await ensureDirs();

        if (!await sessionExists()) {
            await createSession();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const ist = new Date();
        const dateStr = ist.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = ist.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        // 1. Load Dynamic Persona
        const persona = await loadDynamicPersona();

        // 2. Get Hot Context (Daily Notes + Events)
        const hotContext = await getHotContext(ist);

        // 3. Get recent conversations first (needed for smart context)
        // v2: Memory-backed context — FTS + vector search replaces lossy compression
        const { buildSmartContext } = await import('./context-compressor');
        const googleApiKey = process.env.GOOGLE_AI_API_KEY || '';
        const compressedContext = await buildSmartContext(userMessage, googleApiKey);

        // Still get recent for smart context detection
        const recentConversations = await getRecentConversations(10);

        // 4. Get Smart Context (Feature 5: Smart Context Expansion)
        const relevantContext = await getRelevantContext(userMessage, recentConversations);

        // 5. Get Task Context (Feature #6: Multi-turn Task Tracking)
        const taskContext = await getTaskContext();

        // Use compressed context instead of full conversation history
        // This saves 60-70% tokens per request
        const conversationContext = compressedContext;

        const fullPrompt = `Today's Date: ${dateStr}
Current Time: ${timeStr} (IST)

# MASTER PERSONA (from vp/NYX.md)
${persona}

${hotContext}
${taskContext}
${relevantContext}
${conversationContext}
---

Current message from VPK:
${userMessage || (imagePath ? 'Analyze this image.' : '')}

Respond as NYX. Use the provided context. If information is missing, state it. Do not hallucinate.`;

        const promptId = Date.now();
        const promptInputFile = join(PROMPT_DIR, `input_${promptId}.txt`);
        await writeFile(promptInputFile, fullPrompt);

        await execAsync(`tmux send-keys -t ${TMUX_SESSION_NAME} C-c`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await execAsync(`tmux send-keys -t ${TMUX_SESSION_NAME} clear Enter`);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Use -o text for clean output (no JSON, no interactive prompts)
        // Use -s for Google Search Grounding (Feature #2)
        const responseOutputFile = join(OUTPUT_DIR, `response_${promptId}.txt`);
        const imageFlag = imagePath ? `-i "${imagePath}"` : '';
        const geminiCommand = `cd /home/ubuntu/vp && cat ${promptInputFile} | gemini -y -s ${imageFlag} -o text 2>/dev/null > ${responseOutputFile}; echo "${DONE_MARKER}"`;

        console.log('[GEMINI-TMUX] Executing v4 command with stdin pipe and -o text');
        await sendToTmux(geminiCommand);

        await waitForDoneMarker(120000);
        const response = await extractResponseFromFile(responseOutputFile);

        // Cleanup temp files
        await unlink(promptInputFile).catch(() => {});
        await unlink(responseOutputFile).catch(() => {});

        if (!response || response.length < 5) {
            throw new Error('Empty or invalid response from Gemini');
        }

        return response;
    } catch (error: any) {
        console.error('[GEMINI-TMUX] Error:', error.message);
        throw new Error(`Gemini Tmux error: ${error.message}`);
    }
}

/**
 * Public API: Send a message to Gemini CLI via tmux with queueing
 * This ensures only one request is processed at a time, preventing conflicts
 */
export async function sendToGeminiTmux(userMessage: string, imagePath?: string): Promise<string> {
    return enqueueRequest(userMessage, imagePath);
}

/**
 * Get the tmux session name for manual inspection
 */
export function getTmuxSessionName(): string {
    return TMUX_SESSION_NAME;
}

/**
 * Manually attach to the tmux session (for debugging)
 */
export async function attachToSession(): Promise<string> {
    return `tmux attach-session -t ${TMUX_SESSION_NAME}`;
}

/**
 * Get recent tmux session output
 */
export async function getRecentOutput(lines: number = 100): Promise<string> {
    try {
        const { stdout } = await execAsync(`tmux capture-pane -t ${TMUX_SESSION_NAME} -p -S -${lines}`);
        return stdout;
    } catch (error) {
        return 'Could not capture tmux output';
    }
}

/**
 * Health check for tmux
 */
export async function checkTmuxHealth(): Promise<boolean> {
    try {
        await execAsync('which tmux', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}
