# NYX-Verbal - Quick Start Guide

## ✨ What You Can Do Now

### 1. **Chat with NYX (Core Persona) via NYX-Verbal**

Just send any message to NYX-Verbal and NYX (Core Persona) will respond!

**Examples:**

```
You: Hey NYX, what's on my schedule today?
NYX: [Checks your vault and responds with context]

You: Show me my recent transactions
NYX: [References 04-Finance folder]

You: What's in my inbox?
NYX: [Checks 01-Inbox folder]

You: List files in 02-Projects
NYX: [Can access and discuss vp folder contents]
```

**NYX understands your vp context:**
- Working directory: `/home/ubuntu/vp`
- All file paths are assumed relative to vp folder
- Has knowledge of your vault structure (Daily Notes, Finance, Projects, etc.)

### 2. **Receive Autonomous Insights**

NYX will proactively message you:

**🌅 Morning Briefing (7-9 AM IST)**
```
Good morning, Sir.

Today is Monday. Your Pantheon systems are running optimally.

Recent focus areas: tasks, deadlines, projects

I'm here if you need anything. Have a productive day.
```

**🌙 Evening Summary (8-10 PM IST)**
```
Good evening, Sir.

Daily Pantheon Report:
• Conversations today: 15
• Topics addressed: tasks, meetings, deadlines

All systems nominal. Rest well.
```

**💭 Inactivity Check (6-12 hours)**
```
Sir, I noticed it's been 8 hours since our last interaction.

Everything is running smoothly on Pantheon. Reach out if you need me.
```

### 3. **How It Works**

```
Your Telegram Message
        ↓
NYX processes via Gemini CLI
        ↓
- Runs in /home/ubuntu/vp context
- Has conversation history
- Knows your vault structure
- Falls back to Groq if needed
        ↓
Response sent to Telegram
```

## 📊 System Status

**Check health:**
```bash
curl http://localhost:3000/api/nyx/status
```

**Monitor logs:**
```bash
pm2 logs pantheon-server
```

**Conversation stats:**
```bash
curl http://localhost:3000/api/nyx/status | jq '.conversations'
```

## 🔧 Key Features

### ✅ Working Directory Context
- Gemini CLI executes from `/home/ubuntu/vp`
- Can access your vault files
- Understands folder structure
- No need to specify full paths

### ✅ Conversation Memory
- Last 10 exchanges included in each prompt
- 500 message rolling buffer
- Tracks which AI model was used
- Stored in `data/nyx_conversations.json`

### ✅ Smart Fallback
- Primary: Gemini CLI (local, powerful)
- Fallback: Groq API (fast, reliable)
- Automatic switching on errors

### ✅ Autonomous Insights
- Time-based notifications
- Context-aware messaging
- Won't spam (2-hour cooldown)
- Hourly checks running in background

## 💬 Usage Tips

### Natural Conversation
```
✅ "What's in my finance folder?"
✅ "Check today's daily note"
✅ "List my active projects"
✅ "What did I work on yesterday?"
```

### File Operations
```
✅ "Read 00-Daily_Notes/Mar 09, 2026.md"
✅ "What's in 04-Finance/transactions.csv"
✅ "Show me recent agent outputs"
```

### General Assistance
```
✅ "Summarize my week"
✅ "What are my upcoming deadlines?"
✅ "Status report on pantheon-server"
```

## 🛠️ Admin Commands

**Restart server:**
```bash
cd /home/ubuntu/vp/05-Development/pantheon-server
npm run build
pm2 restart pantheon-server
```

**View conversations:**
```bash
cat data/nyx_conversations.json | jq '.[-10:]'
```

**Check scheduler:**
```bash
pm2 logs pantheon-server | grep AUTONOMOUS
```

## 📁 Data Storage

- **Conversations**: `data/nyx_conversations.json`
- **Message queue**: `data/nyx_queue.json`
- **Agent logs**: `data/agent_logs.json`

## 🎯 Current Status

✅ **Active Services:**
- Telegram webhook: Receiving messages
- Gemini CLI: Processing with vp context
- Groq API: Ready as fallback
- Autonomous scheduler: Running hourly checks
- Conversation tracking: 500 message buffer

✅ **Working Directory:**
- Context: `/home/ubuntu/vp`
- Gemini executes from vp folder
- Full access to vault structure

## 🔒 Security

- Only authorized chat ID can message
- Webhook secret token validation
- Local conversation storage
- No external data sharing

## 📚 Full Documentation

See [`NYX_GEMINI_INTEGRATION.md`](./NYX_GEMINI_INTEGRATION.md) for:
- Complete architecture
- API documentation
- Troubleshooting guide
- Performance details
- Future enhancements

---

**Version:** 1.1.0
**Last Updated:** 2026-03-09
**Status:** ✅ Deployed and Running
