# n8n Data Sync to NYX Memory - Complete Setup Guide

## Overview

This system automatically syncs all your data sources to NYX's vector memory database:
- 📧 **Gmail**: Every hour
- 📅 **Google Calendar**: Every 2 hours
- ✅ **Google Tasks**: Every 3 hours
- 💬 **SMS (via Tasker)**: Real-time webhook
- 📱 **Telegram**: Real-time archival (parallel to main bot)

## Architecture

```
Data Sources → n8n Workflows → /api/memory/ingest → Vector Database
                                                         ↓
                                                    NYX can search
                                                    and reference
                                                    all your data
```

## Prerequisites

### 1. Build and Deploy New API Endpoint

```bash
cd /home/ubuntu/pantheon-new
npm run build
pm2 restart pantheon-new
```

### 2. Verify API is Working

```bash
curl -X POST http://localhost:3001/api/memory/ingest \
  -H "X-API-Key: 65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "note",
    "items": [{
      "timestamp": "2026-03-19T10:00:00Z",
      "content": "Test memory ingestion"
    }]
  }'
```

Expected response:
```json
{
  "success": true,
  "ingested": 1,
  "embedded": 1
}
```

## n8n Setup

### Step 1: Access n8n
Open: **https://n8n-nyx.katthan.online**

### Step 2: Set Up OAuth Credentials

#### Gmail OAuth2
1. Go to **Credentials** menu
2. Click **+ New Credential**
3. Select **Gmail OAuth2 API**
4. Use your existing Google OAuth credentials from `/home/ubuntu/vp/.scripts/credentials.json`
5. Complete OAuth flow

#### Google Calendar OAuth2
1. Same as Gmail - use the same OAuth app
2. Ensure scopes include: `https://www.googleapis.com/auth/calendar`

#### Google Tasks OAuth2
1. Same as Gmail - use the same OAuth app
2. Ensure scopes include: `https://www.googleapis.com/auth/tasks.readonly`

### Step 3: Import Workflows

The workflows are in: `/home/ubuntu/n8n_data_sync_workflows.json`

**For each workflow:**

1. Click **Workflows** → **+ Add Workflow**
2. Click **three dots menu (⋮)** → **Import from File**
3. Import one of these workflows:
   - **Pantheon: Gmail to Memory**
   - **Pantheon: Calendar to Memory**
   - **Pantheon: Google Tasks to Memory**
   - **Pantheon: Tasker SMS to Memory**
   - **Pantheon: Telegram to Memory**

4. **Update Credential IDs** in each workflow:
   - Click on the node that needs credentials (e.g., "Fetch Recent Emails")
   - Select your OAuth2 credential from the dropdown
   - Save

5. Click **Save** and then **Activate** (toggle switch at top)

### Step 4: Configure Tasker Integration (Optional)

#### On Your Android Phone:

1. Install **Tasker** (if not already installed)
2. Create a new Profile:
   - **Event** → **Phone** → **Received Text**
3. Add Task:
   - **Net** → **HTTP Request**
   - **Method**: POST
   - **URL**: `https://n8n-nyx.katthan.online/webhook/tasker-sms`
   - **Headers**: `Content-Type: application/json`
   - **Body**:
   ```json
   {
     "from": "%SMSRF",
     "body": "%SMSRB",
     "timestamp": "%SMSRD",
     "number": "%SMSRN"
   }
   ```
4. Save and Enable

Now every SMS you receive will be automatically synced to NYX's memory!

### Step 5: Telegram Archival Setup

This workflow archives ALL Telegram messages (yours + NYX's responses) to memory.

**Option A: Separate Webhook (Recommended)**
- The workflow uses webhook path: `/webhook/telegram-archive`
- Keep main bot at: `https://nyx.katthan.online/api/webhook/telegram`
- This workflow is for archival only, doesn't send replies

**Option B: Dual Webhook (Advanced)**
- Set up Telegram webhook to send updates to both URLs
- Requires webhook proxy or Telegram Bot API modifications

For now, **Option A is automatic** - the main telegram webhook handler should be updated to also call the memory ingest API.

### Step 6: Test Each Workflow

#### Test Gmail Sync
1. In n8n, open "Pantheon: Gmail to Memory" workflow
2. Click **Execute Workflow** button (play icon)
3. Check execution history - should show emails fetched and ingested
4. Check pantheon-new logs: `pm2 logs pantheon-new | grep MEMORY-INGEST`

#### Test Calendar Sync
1. Open "Pantheon: Calendar to Memory" workflow
2. Click **Execute Workflow**
3. Should fetch upcoming events and past events from last 2 hours

#### Test Tasks Sync
1. Open "Pantheon: Google Tasks to Memory" workflow
2. Click **Execute Workflow**
3. Should fetch all tasks from default list

#### Test SMS Webhook
```bash
curl -X POST https://n8n-nyx.katthan.online/webhook/tasker-sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Test Contact",
    "body": "Test SMS message",
    "timestamp": "2026-03-19T10:00:00Z",
    "number": "+1234567890"
  }'
```

## Verification

### Check Memory Count
```bash
cd /home/ubuntu/pantheon-new
npm run dev
# Then in another terminal:
node -e "
const { getMemoryStats } = require('./server/utils/memory-store.ts');
console.log(getMemoryStats());
"
```

### Query NYX About Your Data
Send a message to Telegram bot:
- "What emails did I receive recently?"
- "What's on my calendar tomorrow?"
- "Show me my pending tasks"
- "Do I have any SMS from [name]?"

NYX will now search through all your synced data!

## Data Flow Details

### Memory Ingestion Format

All data is stored as "memory pairs" in the vector database:

```
User Message: [TYPE] Metadata (timestamp, from, subject, etc.)
NYX Response: The actual content (email body, event details, etc.)
```

This format allows:
- Full-text search across all data
- Semantic vector search
- Chronological retrieval
- Importance-based filtering

### Example: Email Storage

```
User Message: "[EMAIL RECEIVED] On Mar 19, 2026, 10:30 AM
               From: boss@company.com
               To: VPK
               Subject: Urgent: Project deadline"

NYX Response: "Hi VPK, Please complete the project report
               by Friday EOD. Let me know if you need help.
               Thanks, Boss"
```

When you ask NYX: "What did my boss say about the project?"
- Vector search finds this memory
- NYX responds: "Your boss sent an email on Mar 19 about an urgent project deadline. They need the project report by Friday EOD."

## Scheduling

| Workflow | Frequency | Reason |
|----------|-----------|--------|
| Gmail | Every 1 hour | Balance between freshness and API quotas |
| Calendar | Every 2 hours | Events don't change that often |
| Tasks | Every 3 hours | Task updates are less frequent |
| SMS | Real-time | Webhook triggers immediately |
| Telegram | Real-time | Archives as conversations happen |

**To adjust frequency:**
1. Open workflow in n8n
2. Click on "Schedule" node
3. Modify the interval
4. Save and reactivate

## Monitoring

### Check n8n Execution History
- In n8n, click **Executions** in left sidebar
- View success/failure of each workflow run
- See how many items were processed

### Check pantheon-new Logs
```bash
pm2 logs pantheon-new --lines 100 | grep -E "MEMORY-INGEST|MEMORY-STORE"
```

### Check Vector Database Size
```bash
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db "SELECT COUNT(*) FROM nyx_memory;"
```

### Check Embedding Status
```bash
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db "
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN embedded = 1 THEN 1 ELSE 0 END) as embedded,
  SUM(CASE WHEN embedded = 0 THEN 1 ELSE 0 END) as pending
FROM nyx_memory;
"
```

## Troubleshooting

### "401 Unauthorized" Error
- Check that `PANTHEON_API_KEY` environment variable is set in n8n docker-compose.yml
- Verify the API key matches in both pantheon-new and n8n

### OAuth Errors (Gmail/Calendar/Tasks)
- Re-authenticate the OAuth credential in n8n
- Check that scopes include necessary permissions
- Ensure token hasn't expired

### "No items to process"
- For scheduled workflows, they only fetch NEW data
- Gmail uses `newer_than:1h` query filter
- Calendar uses time range based on last execution

### High API Usage
- Reduce frequency of scheduled workflows
- Lower the `limit` parameter in fetch nodes
- Monitor Google API quotas at: https://console.cloud.google.com/apis/dashboard

### Embeddings Not Working
- Check Google AI API key is set: `GOOGLE_AI_API_KEY`
- Verify API key has access to Gemini/PaLM embeddings
- Check logs for embedding errors

## Advanced: Auto-Embedding Background Job

To automatically embed memories in the background, you can create a cron workflow:

```json
{
  "name": "Pantheon: Auto Embed Memories",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{"field": "minutes", "minutesInterval": 15}]
        }
      },
      "name": "Every 15 Minutes",
      "type": "n8n-nodes-base.scheduleTrigger"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://141.148.210.250:3001/api/memory/embed",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "X-API-Key", "value": "={{ $env.PANTHEON_API_KEY }}"}
          ]
        }
      },
      "name": "Trigger Embedding",
      "type": "n8n-nodes-base.httpRequest"
    }
  ]
}
```

## Privacy & Data Management

### Data Retention
- Memories are NEVER automatically deleted
- All data is stored locally in your vector database
- No data leaves your server

### Manual Cleanup (if needed)
```sql
-- Delete memories older than 1 year
DELETE FROM nyx_memory WHERE timestamp < date('now', '-1 year');

-- Delete low-importance routine memories older than 3 months
DELETE FROM nyx_memory WHERE importance = 0 AND timestamp < date('now', '-3 months');

-- Rebuild FTS index after deletion
INSERT INTO nyx_memory_fts(nyx_memory_fts) VALUES('rebuild');
```

### Data Export
```bash
# Export all memories to JSON
sqlite3 -json /home/ubuntu/pantheon-new/data/pantheon_vectors.db \
  "SELECT * FROM nyx_memory ORDER BY timestamp DESC" > nyx_memories_backup.json
```

## Next Steps

1. ✅ Build and deploy the memory ingestion API
2. ✅ Import all 5 workflows to n8n
3. ✅ Set up OAuth credentials
4. ✅ Test each workflow manually
5. ✅ Activate workflows
6. ✅ Configure Tasker on phone (optional)
7. ✅ Monitor execution logs for 24 hours
8. ✅ Ask NYX questions about your data to verify search works

## Summary

Once set up, NYX will have **complete context** from:
- ✉️ All your emails
- 📅 All your calendar events
- ✅ All your tasks
- 💬 All your SMS messages
- 📱 All your Telegram conversations

This transforms NYX from a simple chatbot into a true **personal AI assistant** with comprehensive knowledge of your digital life!
