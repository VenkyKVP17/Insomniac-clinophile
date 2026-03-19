# Import Simple Telegram Workflow to n8n

## Current Status
- The old "Pantheon: NYX Telegram Master v2" workflow has a syntax error and won't activate
- A new simplified workflow has been created: `/home/ubuntu/n8n_telegram_simple_v3.json`
- pantheon-new has a new endpoint `/api/intelligence/telegram` that handles everything (vector search + Groq + sending Telegram reply)

## Steps to Import and Activate

### 1. Access n8n UI
Open in browser: **https://n8n-nyx.katthan.online**

### 2. Deactivate Old Workflow
- Find workflow: "Pantheon: NYX Telegram Master v2"
- Click the toggle to **deactivate** it (if it's not already showing as errored)
- Optionally delete it to avoid confusion

### 3. Import New Workflow
- Click **"+ Add Workflow"** or the **Workflows** menu
- Click the **three dots menu** (⋮) in top right
- Select **"Import from File"**
- Choose file: `/home/ubuntu/n8n_telegram_simple_v3.json`

### 4. Verify Workflow Configuration
The workflow should have 2 nodes:

**Node 1: Telegram Webhook**
- Type: Webhook
- Path: `telegram-bot`
- HTTP Method: POST
- Response Mode: Last Node

**Node 2: Forward to Pantheon**
- Type: HTTP Request
- Method: POST
- URL: `http://141.148.210.250:3001/api/intelligence/telegram`
- Headers:
  - `X-API-Key`: `65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863`
  - `Content-Type`: `application/json`
- Body: `={{ JSON.stringify($json) }}`

### 5. Activate Workflow
- Click the **toggle switch** at the top to activate
- Status should change to **Active** (green)
- n8n will register the webhook endpoint

### 6. Get Webhook URL
- Click on the **"Telegram Webhook"** node
- Copy the **Production URL** (should be something like: `https://n8n-nyx.katthan.online/webhook/telegram-bot`)

### 7. Update Telegram Webhook

**Option A: Via n8n (if you have Telegram node credentials)**
- Add a "Set Webhook" node to do this automatically

**Option B: Via curl (ALREADY DONE IN PREVIOUS SESSION)**
The webhook is currently pointing to: `https://nyx.katthan.online/api/webhook/telegram`

To switch to n8n, run:
```bash
TELEGRAM_BOT_TOKEN="your_token_here"
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://n8n-nyx.katthan.online/webhook/telegram-bot",
    "allowed_updates": ["message", "callback_query"]
  }'
```

### 8. Test
- Send a message to your Telegram bot
- Check n8n execution history to see if workflow ran
- Check pantheon-new logs: `pm2 logs pantheon-new --lines 50`

## How It Works

```
Telegram → n8n webhook → pantheon-new /api/intelligence/telegram
                                            ↓
                                    1. Extract message.text
                                    2. Search vector DB (217 chunks)
                                    3. Call Groq API with context
                                    4. Send reply via Telegram API
                                            ↓
                                    User receives reply
```

## Troubleshooting

**Workflow won't activate:**
- Check n8n logs: `cd /home/ubuntu/pantheon_n8n && docker compose logs n8n --tail 50`
- Verify JSON syntax in the workflow file
- Ensure no duplicate webhook paths exist

**No replies to Telegram:**
- Check n8n execution history (click "Executions" in left menu)
- Check pantheon-new logs: `pm2 logs pantheon-new`
- Verify Telegram webhook is pointing to n8n URL: `curl https://api.telegram.org/bot${TOKEN}/getWebhookInfo`

**"Unauthorized" errors:**
- Verify X-API-Key matches PANTHEON_API_KEY in docker-compose.yml
- Current key: `65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863`

## Alternative: Keep Using pantheon-new Directly

If n8n continues having issues, the Telegram bot can work perfectly without n8n:

1. Telegram webhook stays at: `https://nyx.katthan.online/api/webhook/telegram`
2. pantheon-new handles everything directly (already working)
3. Defer n8n integration for later when you need Gmail/Calendar/etc.

The hybrid architecture can be implemented later once the basic flow is stable.
