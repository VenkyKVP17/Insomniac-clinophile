# n8n Workflows for Data Sync to NYX Memory

## Files

Each workflow is in a separate JSON file for easy importing:

1. **01_gmail_to_memory.json** - Syncs Gmail every hour
2. **02_calendar_to_memory.json** - Syncs Google Calendar every 2 hours
3. **03_tasks_to_memory.json** - Syncs Google Tasks every 3 hours
4. **04_sms_to_memory.json** - Webhook for Tasker SMS (real-time)
5. **05_telegram_to_memory.json** - Webhook for Telegram archival (real-time)

## How to Import

### Option 1: Via n8n UI (Easiest)

1. Open n8n: https://n8n-nyx.katthan.online
2. Click **Workflows** → **Add Workflow** (+ button)
3. Click the **three dots menu (⋮)** in top right
4. Select **"Import from File"**
5. Browse to `/home/ubuntu/n8n_workflows/` and select a workflow file
6. Click **Open**
7. Workflow will be imported!

Repeat for each of the 5 workflow files.

### Option 2: Copy-Paste (Alternative)

If file import doesn't work:

1. Open the JSON file in a text editor
2. Copy **ALL** the contents (Ctrl+A, Ctrl+C)
3. In n8n, click **Workflows** → **Add Workflow**
4. Click **three dots menu (⋮)** → **Import from Text**
5. Paste the JSON
6. Click **Import**

## After Importing

### 1. Configure Credentials

For **Gmail workflow**:
- Click on "Fetch Recent Emails" node
- Click "Credential to connect with"
- Select or create Gmail OAuth2 credential

For **Calendar workflow**:
- Click on "Fetch Calendar Events" node
- Select or create Google Calendar OAuth2 credential

For **Tasks workflow**:
- Click on "Fetch Tasks" node
- Select or create Google Tasks OAuth2 credential

For **SMS and Telegram webhooks**:
- No credentials needed! They use API key from environment variable

### 2. Verify Environment Variable

All workflows use: `{{ $env.PANTHEON_API_KEY }}`

This is already configured in your docker-compose.yml:
```yaml
- PANTHEON_API_KEY=65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863
```

### 3. Test Each Workflow

Before activating:
1. Click **Execute Workflow** button
2. Check execution log for success/errors
3. Verify data was ingested: `pm2 logs pantheon-new | grep MEMORY-INGEST`

### 4. Activate Workflows

Once tested, click the **Activate** toggle switch at the top.

## Webhook URLs

After activating webhook workflows, note these URLs:

- **SMS Webhook**: `https://n8n-nyx.katthan.online/webhook/tasker-sms`
- **Telegram Archive**: `https://n8n-nyx.katthan.online/webhook/telegram-archive`

Use these in:
- Tasker on your phone (for SMS)
- Additional Telegram webhook setup (optional)

## Troubleshooting

### "Cannot find credential"
- You need to create OAuth2 credentials first
- Go to **Credentials** menu → **Add Credential**
- Select Gmail/Calendar/Tasks OAuth2
- Follow OAuth flow

### "Environment variable not found"
- Restart n8n: `cd /home/ubuntu/pantheon_n8n && docker compose restart n8n`
- Check docker-compose.yml has PANTHEON_API_KEY set

### "401 Unauthorized"
- Verify API key matches in both places:
  - n8n: `$env.PANTHEON_API_KEY`
  - pantheon-new: `.env` file

### Workflow doesn't fetch data
- Gmail: Check the "q" parameter in options (newer_than:1h)
- Calendar: Check time range in options
- Tasks: Should fetch all tasks by default

## Schedule Reference

| Workflow | Runs | Fetches |
|----------|------|---------|
| Gmail | Every 1 hour | Emails from last 1 hour |
| Calendar | Every 2 hours | Events: -2h to +7 days |
| Tasks | Every 3 hours | All tasks |
| SMS | On webhook trigger | Real-time |
| Telegram | On webhook trigger | Real-time |

## Support

For detailed setup instructions, see:
- [N8N_DATA_SYNC_SETUP.md](../N8N_DATA_SYNC_SETUP.md)
- [DATA_SYNC_SUMMARY.md](../DATA_SYNC_SUMMARY.md)
