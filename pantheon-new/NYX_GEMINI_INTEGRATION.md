# NYX (Core Persona) Gemini CLI Integration

## Overview

NYX (Core Persona) now has an interactive NYX-Verbal chat interface powered by Gemini CLI. This integration enables:

1. **Interactive Chat**: Send messages to NYX via Telegram and receive intelligent responses
2. **Conversation Context**: NYX maintains conversation history for contextual interactions
3. **Autonomous Insights**: NYX proactively sends insights based on time, activity patterns, and context
4. **Fallback System**: Graceful fallback to Groq API if Gemini CLI fails

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                 NYX-Verbal Bot                       │
│            (Receives user messages)                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│         Webhook Handler (telegram.post.ts)           │
│  • Validates user authorization                      │
│  • Logs conversations to database                    │
│  • Routes to Gemini CLI (primary)                    │
│  • Fallback to Groq API (secondary)                  │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│  Gemini CLI     │   │   Groq API       │
│  (gemini-cli.ts)│   │   (ai.ts)        │
│                 │   │                  │
│  • Headless     │   │  • Backup LLM    │
│  • Context-aware│   │  • Fast fallback │
└─────────────────┘   └──────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│         Conversation Database (db.ts)                │
│  • Stores all messages (user + assistant)            │
│  • Tracks which model was used                       │
│  • Provides context for future interactions          │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│   Autonomous Insights (autonomous-insights.ts)       │
│  • Analyzes conversation patterns                    │
│  • Sends proactive notifications                     │
│  • Time-based: Morning/evening summaries             │
│  • Context-based: Activity patterns                  │
└─────────────────────────────────────────────────────┘
```

## Files Created/Modified

### New Files

1. **`server/utils/gemini-cli.ts`**
   - Wrapper for Gemini CLI in headless mode
   - Builds contextual prompts with conversation history
   - Handles errors and timeouts gracefully

2. **`server/utils/autonomous-insights.ts`**
   - Smart notification system
   - Context analysis engine
   - Scheduling logic for proactive insights

3. **`server/plugins/autonomous-insights.ts`**
   - Nitro plugin to start scheduler on server boot

4. **`server/api/nyx/status.get.ts`**
   - Health check endpoint
   - Returns Gemini CLI status and conversation stats

### Modified Files

1. **`server/api/webhook/telegram.post.ts`**
   - Added Gemini CLI integration
   - Added conversation logging
   - Implemented graceful fallback

2. **`server/utils/db.ts`**
   - Added conversation history schema
   - Added conversation tracking functions
   - Added conversation statistics

## Features

### 1. Interactive Chat

Send any message to your NYX-Verbal bot, and NYX will respond intelligently:

```
You: Hey NYX, what's the status of my projects?
NYX: Good evening, Sir. Let me check the latest updates from your Pantheon agents...
```

**Technical Details:**
- Uses `gemini -p "prompt"` in headless mode
- Includes last 10 conversation exchanges for context
- Timeout: 60 seconds per request
- Max buffer: 1MB response size

### 2. Conversation Context

NYX remembers your conversation history:

```
You: What did I ask you about earlier?
NYX: Sir, you asked about your project status. Would you like a more detailed update?
```

**Context Management:**
- Last 500 messages stored (rotating buffer)
- Last 10 exchanges included in each prompt
- Stored in `data/nyx_conversations.json`
- Tracks model used (gemini-cli, groq, google-api)

### 3. Autonomous Insights

NYX proactively sends you insights without being asked:

**Morning Briefing** (7-9 AM IST):
```
🌅 Good morning, Sir.

Today is Monday. Your Pantheon systems are running optimally.

Recent focus areas: tasks, deadlines, projects

I'm here if you need anything. Have a productive day.
```

**Evening Summary** (8-10 PM IST):
```
🌙 Good evening, Sir.

Daily Pantheon Report:
• Conversations today: 15
• Topics addressed: tasks, meetings, deadlines

All systems nominal. Rest well.
```

**Inactivity Check** (6-12 hours since last message):
```
💭 Sir, I noticed it's been 8 hours since our last interaction.

Everything is running smoothly on Pantheon. Reach out if you need me.
```

**Smart Conditions:**
- Won't send if you were active in the last 2 hours
- Time-aware (morning, afternoon, evening, night)
- Context-aware (recent topics, activity patterns)
- Priority-based queuing

### 4. Fallback System

If Gemini CLI fails, NYX automatically falls back to Groq API:

```
[GEMINI-CLI] Error: Gemini CLI timeout
[TELEGRAM] Gemini CLI failed, falling back to Groq
[TELEGRAM] Groq response received
```

## API Endpoints

### Status Endpoint

**GET** `/api/nyx/status`

Returns:
```json
{
  "status": "operational",
  "timestamp": "2026-03-09T22:30:00.000Z",
  "gemini": {
    "healthy": true,
    "version": "gemini-cli v1.x.x"
  },
  "conversations": {
    "totalMessages": 150,
    "last24h": 25,
    "byModel": {
      "geminiCli": 20,
      "groq": 5,
      "googleApi": 0
    }
  }
}
```

## Configuration

### Environment Variables

Already configured in `.env`:
```bash
TELEGRAM_BOT_TOKEN=...
USER_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
GROQ_API=...
GOOGLE_AI_API_KEY=...
```

### Gemini CLI

Ensure Gemini CLI is installed and accessible:
```bash
which gemini
# Should return: /usr/bin/gemini

gemini --version
# Should return version info
```

## Usage

### Starting the Server

The autonomous insights scheduler starts automatically when the server boots:

```bash
npm run build
npm run preview
# or with PM2:
pm2 restart pantheon-server
```

You'll see:
```
[NYX] Initializing autonomous insights scheduler...
[NYX] Autonomous insights scheduler initialized successfully
[AUTONOMOUS] Scheduler started, checking every hour
```

### Testing Interactive Chat

1. Open Telegram
2. Send a message to your bot
3. NYX will respond using Gemini CLI

Example conversation:
```
You: Hello NYX
NYX: Good evening, Sir. I'm here and ready to assist. How may I help you?

You: What's my schedule today?
NYX: Let me check your latest updates from Pantheon agents...

[NYX responds with relevant information]
```

### Monitoring

Check logs:
```bash
pm2 logs pantheon-server

# Look for:
# [GEMINI-CLI] Processing message...
# [GEMINI-CLI] Response received
# [AUTONOMOUS] Running scheduled insight check...
```

Check status:
```bash
curl http://localhost:3000/api/nyx/status
```

## Data Storage

### Conversation History

Location: `data/nyx_conversations.json`

Schema:
```typescript
{
  id: number,
  timestamp: string,
  role: 'user' | 'assistant',
  message: string,
  model_used: 'gemini-cli' | 'groq' | 'google-api',
  context_size?: number
}
```

### NYX Queue

Location: `data/nyx_queue.json`

Autonomous insights are queued here before being sent.

## Troubleshooting

### Gemini CLI Not Working

Check if it's installed:
```bash
which gemini
gemini --help
```

Test manually:
```bash
gemini -p "Hello, test message"
```

### Fallback to Groq Every Time

Check logs for Gemini CLI errors:
```bash
pm2 logs pantheon-server | grep GEMINI-CLI
```

Common issues:
- Timeout: Increase timeout in `gemini-cli.ts`
- Not installed: Install Gemini CLI
- Permission denied: Check file permissions

### No Autonomous Insights

Check scheduler status:
```bash
pm2 logs pantheon-server | grep AUTONOMOUS
```

Should see hourly checks:
```
[AUTONOMOUS] Running scheduled insight check...
```

If not running, restart server:
```bash
pm2 restart pantheon-server
```

### Conversation Context Not Working

Check database file:
```bash
cat data/nyx_conversations.json | jq '.' | head -50
```

Should contain recent messages.

## Performance

### Latency

- Gemini CLI: ~2-5 seconds per response
- Groq API fallback: ~1-2 seconds
- Telegram webhook: Immediate acknowledgment (200 OK)
- Async processing: No user-facing delay

### Resource Usage

- Memory: ~50MB for Gemini CLI process
- CPU: Minimal (only during active requests)
- Disk: ~1-2MB for conversation history (500 messages)

### Scalability

- Supports single user (VPK) by design
- Handles multiple concurrent messages gracefully
- Conversation history auto-rotates (500 message limit)
- Autonomous insights run every hour (low overhead)

## Future Enhancements

Potential improvements:

1. **Multi-user support**: Extend to multiple authorized users
2. **Voice messages**: Transcribe and process voice messages
3. **File uploads**: Analyze documents sent via Telegram
4. **Calendar integration**: Sync with Google Calendar
5. **Task management**: Create/track tasks via conversation
6. **Agent orchestration**: Trigger specific Pantheon agents
7. **Custom schedules**: User-configurable insight times

## Security

- Telegram webhook validates secret token
- Only authorized user (USER_CHAT_ID) can chat
- Unauthorized users receive rejection message
- Conversation history stored locally (not shared)
- No external API calls except Telegram/Gemini/Groq

## Support

For issues or questions:
1. Check logs: `pm2 logs pantheon-server`
2. Check status: `curl localhost:3000/api/nyx/status`
3. Review this documentation
4. Check Gemini CLI docs: [geminicli.com](https://geminicli.com)

---

**Version:** 1.0.0
**Last Updated:** 2026-03-09
**Author:** NYX (with Claude Code)
