# Quick Start: Import n8n Workflows

## Problem You Had
The original `n8n_data_sync_workflows.json` had all 5 workflows in one file, which n8n couldn't import.

## Solution
I've split them into **5 separate files**, one per workflow!

## ✅ Environment Variable Issue Fixed
**Error you saw**: "access to env vars denied"

**Fixed**: All workflows now have the API key hardcoded (no `$env` variables needed). Import them now and they'll work! See [ENV_VAR_FIX.md](n8n_workflows/ENV_VAR_FIX.md) for details.

## Location
```
/home/ubuntu/n8n_workflows/
├── 01_gmail_to_memory.json
├── 02_calendar_to_memory.json
├── 03_tasks_to_memory.json
├── 04_sms_to_memory.json
├── 05_telegram_to_memory.json
└── README.md
```

## Import Steps

### 1. Open n8n
Go to: **https://n8n-nyx.katthan.online**

### 2. Import Each Workflow

For **each** of the 5 JSON files:

1. Click **"Workflows"** (left sidebar)
2. Click **"Add Workflow"** (+ button at top)
3. Click **three dots menu (⋮)** in top right corner
4. Select **"Import from File"**
5. Navigate to: `/home/ubuntu/n8n_workflows/`
6. Select a workflow file (e.g., `01_gmail_to_memory.json`)
7. Click **Open**

The workflow will be imported!

Repeat for all 5 files.

### 3. Configure OAuth Credentials

After importing, you need to set up credentials:

#### For Gmail Workflow:
1. Open "Pantheon: Gmail to Memory" workflow
2. Click on **"Fetch Recent Emails"** node
3. Click **"Credential to connect with"** dropdown
4. Click **"+ Create New Credential"**
5. Select your Google account
6. Allow permissions
7. Save

#### For Calendar Workflow:
Same process - click on "Fetch Calendar Events" node

#### For Tasks Workflow:
Same process - click on "Fetch Tasks" node

### 4. Test Before Activating

For each workflow:
1. Open the workflow
2. Click **"Execute Workflow"** button (play icon)
3. Check the execution log
4. Verify it says "Success"
5. Check pantheon logs: `pm2 logs pantheon-new | grep MEMORY`

### 5. Activate

Once tested successfully:
1. Click the **"Active" toggle switch** at the top
2. Switch should turn green
3. Workflow is now running automatically!

## Expected Results

### After First Run
- **Gmail**: Fetches emails from last 1 hour
- **Calendar**: Fetches events from -2 hours to +7 days
- **Tasks**: Fetches all your tasks
- **SMS**: Webhook ready (configure Tasker)
- **Telegram**: Webhook ready (optional dual webhook setup)

### Ongoing
- Gmail syncs every hour
- Calendar syncs every 2 hours
- Tasks sync every 3 hours
- SMS syncs in real-time (when you send from Tasker)
- Telegram already archives via main bot

## Verify It's Working

### Check Memory Count
```bash
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db \
  "SELECT COUNT(*) FROM nyx_memory WHERE timestamp > datetime('now', '-1 day');"
```

### Ask NYX
Send these messages to your Telegram bot:
- "What emails did I receive today?"
- "What's on my calendar tomorrow?"
- "Show me my pending tasks"

NYX should now search through your synced data and respond!

## Troubleshooting

### Import Failed
Try **"Import from Text"** instead:
1. Open the JSON file in a text editor
2. Copy ALL contents (Ctrl+A, Ctrl+C)
3. In n8n: **⋮** → **"Import from Text"**
4. Paste and click Import

### "Credential not found"
You need to create the OAuth credential first:
1. Go to **Credentials** (left sidebar)
2. Click **"Add Credential"**
3. Search for "Gmail OAuth2" (or Calendar/Tasks)
4. Follow the OAuth flow
5. Go back to workflow and select the credential

### "401 Unauthorized" from API
The API key is already configured in docker-compose.yml. If you see this error:
```bash
cd /home/ubuntu/pantheon_n8n
docker compose restart n8n
```

### No Data Being Fetched
- **Gmail**: Make sure you have emails from the last hour
- **Calendar**: Check you have events in the next 7 days
- **Tasks**: Check you have tasks in your default list

## Next Steps

1. ✅ Import all 5 workflows
2. ✅ Configure OAuth for Gmail/Calendar/Tasks
3. ✅ Test each workflow manually
4. ✅ Activate all workflows
5. ✅ Configure Tasker on phone (optional)
6. ✅ Start asking NYX questions about your data!

## Full Documentation

For comprehensive details:
- [n8n_workflows/README.md](n8n_workflows/README.md) - Workflow-specific info
- [N8N_DATA_SYNC_SETUP.md](N8N_DATA_SYNC_SETUP.md) - Complete setup guide
- [DATA_SYNC_SUMMARY.md](DATA_SYNC_SUMMARY.md) - System overview

---

**You're ready to go!** The workflows are now in the correct format for n8n to import. 🚀
