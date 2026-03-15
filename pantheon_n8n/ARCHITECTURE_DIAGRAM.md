# 🏛️ Pantheon Hybrid Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          VPK (You)                              │
│                      The Almighty User                          │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ Telegram                           │ GitHub Push
             ↓                                    ↓
┌────────────────────────┐          ┌────────────────────────────┐
│   Telegram Bot API     │          │     GitHub Webhook         │
│ (webhook configured)   │          │   (vault repository)       │
└────────────┬───────────┘          └────────────┬───────────────┘
             │                                    │
             │ HTTPS                              │ HTTPS
             ↓                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    n8n Workflow Engine                          │
│                  https://n8n-nyx.katthan.online                 │
│                                                                 │
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  Telegram Master  │  │  GitHub Sync     │  │ Dispatcher  │ │
│  │   Workflow        │  │   Workflow       │  │  Workflow   │ │
│  └────────┬──────────┘  └────────┬─────────┘  └──────┬──────┘ │
│           │                      │                     │        │
│           │                      │                     │        │
└───────────┼──────────────────────┼─────────────────────┼────────┘
            │                      │                     │
            │ API Call             │ API Call            │ API Call
            ↓                      ↓                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              Pantheon Server (Nuxt.js Backend)                  │
│                http://141.148.210.250:3000                      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Intelligence │  │ Agent Runner │  │  Vector Database   │   │
│  │   /api/      │  │   /api/nyx   │  │   /api/internal    │   │
│  │ intelligence │  │              │  │                    │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘   │
│         │                 │                     │              │
│         ↓                 ↓                     ↓              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  Groq AI (Llama 3.3)                     │ │
│  │              Google AI (Gemini Pro)                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │        SQLite Databases + Vector Embeddings              │ │
│  │   /pantheon-data/pantheon.db                             │ │
│  │   /pantheon-data/pantheon_vectors.db                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │                      │
            │ Access               │ Access
            ↓                      ↓
┌────────────────────┐   ┌─────────────────────────────────┐
│  Obsidian Vault    │   │    Python Agent Scripts         │
│  /home/ubuntu/vp   │   │   /home/ubuntu/vp/.scripts      │
│                    │   │                                 │
│  • Tasks           │   │  • chronos_tasks.py             │
│  • Notes           │   │  • plutus_finance.py            │
│  • Projects        │   │  • asclepius_duties.py          │
│  • Finance         │   │  • hermes_integrity.py          │
│  • Agents          │   │  • And 12 more agents...        │
└────────────────────┘   └─────────────────────────────────┘
```

---

## Data Flow Examples

### 📱 **Example 1: Telegram Message "What's my schedule?"**

```
1. You send message to Telegram bot
   ↓
2. Telegram forwards to n8n webhook
   https://n8n-nyx.katthan.online/webhook/pantheon-telegram
   ↓
3. n8n "Pantheon Telegram Master" workflow:
   • Checks authorization (your chat ID)
   • Extracts message text
   • Routes to NYX intelligence
   ↓
4. n8n calls Pantheon Server API:
   POST /api/intelligence/query
   Body: { "prompt": "[TELEGRAM TRIAGE] VPK sent: What's my schedule?" }
   ↓
5. Pantheon Server:
   • Sends prompt to Groq AI (Llama 3.3)
   • Searches vault for schedule
   • Runs CHRONOS agent if needed
   ↓
6. Pantheon Server returns response:
   { "response": "📅 Your schedule today: ..." }
   ↓
7. n8n sends response to Telegram:
   POST https://api.telegram.org/bot.../sendMessage
   ↓
8. You receive NYX's response on Telegram
```

---

### 🔄 **Example 2: Git Push to Vault**

```
1. You commit changes to vault and push to GitHub
   ↓
2. GitHub sends webhook to n8n:
   POST https://n8n-nyx.katthan.online/webhook/pantheon-github-sync
   Headers: X-Hub-Signature-256: <signature>
   ↓
3. n8n "Pantheon GitHub Sync" workflow:
   • Verifies GitHub signature
   • Executes: cd /vault && git pull
   • Executes: git diff HEAD@{1} HEAD --name-only
   ↓
4. n8n categorizes changed files:
   • Tasks: 2 files
   • Notes: 1 file
   • Projects: 0 files
   ↓
5. n8n calls Pantheon Server:
   POST /api/intelligence/query
   Body: { "prompt": "[VAULT SYNC] 3 files changed: ..." }
   ↓
6. Pantheon Server analyzes with AI:
   • Determines importance
   • Generates summary
   ↓
7. If important, n8n sends notification:
   POST https://api.telegram.org/bot.../sendMessage
   Text: "📂 [VAULT SYNC] You updated tasks..."
   ↓
8. n8n calls Pantheon to re-index:
   POST /api/internal/index-vault
   Body: { "files": [...] }
   ↓
9. Pantheon Server updates vector embeddings
```

---

### 📋 **Example 3: Scheduled Notification Dispatch (6am & 9:30pm)**

```
1. n8n cron trigger fires at 06:00 IST
   ↓
2. n8n "Notification Dispatcher v2" workflow:
   • Checks time window (06:00 or 21:30)
   ↓
3. n8n fetches notification queue:
   GET /api/nyx/queue-status
   Response: { "count": 12 }
   ↓
4. n8n gets all queued messages:
   GET /api/nyx/queue
   Response: { "data": [ ... 12 messages ... ] }
   ↓
5. n8n splits messages by priority:
   • P0 (Critical): 1 message → Send immediately
   • P1 (High): 3 messages → Batch for digest
   • P2 (Medium): 5 messages → Batch for digest
   • P3 (Low): 3 messages → Batch for digest
   ↓
6. Send P0 immediately:
   POST https://api.telegram.org/bot.../sendMessage
   Text: "🚨 [P0 - CRITICAL] Database backup failed!"
   ↓
7. Build digest for P1-P3:
   "📋 [NYX DIGEST]

    ⚠️ High Priority (P1)
    1. CHRONOS: Duty overlap detected
    2. PLUTUS: Credit card payment due
    3. ASCLEPIUS: Submit timesheet

    📌 Medium Priority (P2)
    1-5. ...

    💡 Low Priority (P3)
    1-3. ...

    Total: 11 messages"
   ↓
8. Send digest:
   POST https://api.telegram.org/bot.../sendMessage
   ↓
9. Clear queue:
   POST /api/nyx/queue/clear
```

---

## Component Responsibilities

### 🎨 **n8n (Workflow Orchestrator)**

**Handles:**
- ✅ External webhooks (Telegram, GitHub)
- ✅ Workflow routing and logic
- ✅ Scheduling (cron jobs)
- ✅ Error handling and retries
- ✅ Visual workflow management

**Does NOT handle:**
- ❌ AI intelligence (calls Pantheon)
- ❌ Database management (calls Pantheon)
- ❌ Complex agent logic (calls Pantheon)

---

### 🧠 **Pantheon Server (Intelligence Backend)**

**Handles:**
- ✅ Groq AI integration (Llama 3.3)
- ✅ Google AI integration (Gemini)
- ✅ SQLite database operations
- ✅ Vector embeddings (sqlite-vec)
- ✅ Python agent script execution
- ✅ Voice transcription (Groq Whisper)

**Does NOT handle:**
- ❌ Telegram webhooks (n8n handles)
- ❌ GitHub webhooks (n8n handles)
- ❌ Scheduling (n8n handles)

---

### 📁 **Shared Resources**

Both n8n and Pantheon Server access:

1. **Obsidian Vault** (`/home/ubuntu/vp`)
   - n8n: Reads for git operations
   - Pantheon: Reads for intelligence queries

2. **Databases** (`/pantheon-data/`)
   - n8n: Can query directly via SQLite node
   - Pantheon: Primary manager

3. **Python Scripts** (`/home/ubuntu/vp/.scripts`)
   - n8n: Can execute via shell commands
   - Pantheon: Executes via agent runner

---

## Network Topology

```
Internet
   │
   ├─── Telegram Bot API (telegram.org)
   │         │
   │         └─→ Webhook to: n8n-nyx.katthan.online
   │
   ├─── GitHub Webhook (github.com)
   │         │
   │         └─→ Webhook to: n8n-nyx.katthan.online
   │
   └─── Your Mobile/Desktop
             │
             └─→ Access: n8n-nyx.katthan.online (UI)

VPS (Oracle Cloud)
   │
   ├─── n8n Container (port 5678)
   │     │ URL: https://n8n-nyx.katthan.online
   │     │ Mounted: /vault, /pantheon-data, /scripts
   │     │
   │     └─→ Calls: Pantheon Server API (internal)
   │
   └─── Pantheon Server (port 3000)
         │ URL: http://141.148.210.250:3000
         │ Framework: Nuxt.js + Nitro
         │
         └─→ Calls: Groq AI, Google AI (external APIs)
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: External Authentication                       │
│                                                         │
│  • Telegram: X-Telegram-Bot-Api-Secret-Token           │
│  • GitHub: X-Hub-Signature-256 (HMAC)                  │
│  • n8n UI: Password protected                          │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Workflow Authorization                        │
│                                                         │
│  • Telegram: Check USER_CHAT_ID matches                │
│  • GitHub: Verify webhook signature                    │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: API Authentication                            │
│                                                         │
│  • All n8n → Pantheon calls include:                   │
│    Header: X-Pantheon-Key: <PANTHEON_API_KEY>          │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Environment Isolation                         │
│                                                         │
│  • Secrets in Docker environment variables             │
│  • No hardcoded credentials in workflows               │
│  • Read-only mounts where possible                     │
└─────────────────────────────────────────────────────────┘
```

---

## File System Layout

```
/home/ubuntu/
│
├── pantheon_n8n/                          # n8n Configuration
│   ├── docker-compose.yml                 # Updated with env vars
│   ├── data/                              # n8n persistent data
│   │   ├── database.sqlite                # n8n's own DB
│   │   └── n8nEventLog*.log              # Execution logs
│   ├── pantheon_telegram_master.json      # NEW workflow
│   ├── pantheon_github_sync.json          # NEW workflow
│   ├── pantheon_notification_dispatcher.json  # NEW workflow
│   ├── PANTHEON_N8N_SETUP.md             # Setup guide
│   ├── PANTHEON_COMPARISON.md            # Feature comparison
│   ├── QUICK_START.md                     # Quick start
│   ├── ARCHITECTURE_DIAGRAM.md           # This file
│   └── WEBHOOK_COMMANDS.sh               # Webhook setup script
│
└── vp/                                    # Obsidian Vault
    ├── .scripts/                          # Python agent scripts
    │   ├── chronos_tasks.py
    │   ├── plutus_finance.py
    │   └── ... (14 more agents)
    │
    ├── 05-Development/
    │   └── pantheon-server/               # Nuxt.js Backend
    │       ├── server/api/                # API endpoints
    │       ├── server/utils/              # AI, DB, agents
    │       ├── data/                      # Databases
    │       │   ├── pantheon.db
    │       │   └── pantheon_vectors.db
    │       └── .env                       # Server config
    │
    ├── 06-Tasks/                          # Task files
    ├── 07-Daily_Notes/                    # Daily notes
    ├── 09-Assistants/                     # Agent definitions
    └── ... (other vault folders)
```

---

## Monitoring & Debugging

### View n8n Executions
```
https://n8n-nyx.katthan.online/executions
```

### View n8n Logs
```bash
docker logs -f pantheon_n8n
```

### View Pantheon Server Logs
```bash
pm2 logs pantheon-server
```

### Check Webhook Status
```bash
# Telegram
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# GitHub
# Go to: GitHub Repo → Settings → Webhooks → Recent Deliveries
```

---

**Created by:** ZEUS (Claude Code)
**Architecture:** Hybrid n8n + Pantheon Server
**Date:** 2026-03-16
