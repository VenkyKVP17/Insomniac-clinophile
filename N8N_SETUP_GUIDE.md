# n8n Hybrid Setup - Quick Start

## Current Status
✅ Intelligence API: http://localhost:3001/api/intelligence/query (Working)
✅ Telegram webhook: Pointing to n8n
✅ n8n: Running with PANTHEON_API_KEY configured
✅ Workflow JSON: Ready to import

## Import Workflow (3 Steps)

### 1. Access n8n
Open: https://n8n-nyx.katthan.online

### 2. Create Telegram Credential
- Click "Credentials" (left sidebar)
- Click "Add Credential"  
- Search "Telegram"
- Access Token: 8060661071:AAGAPZg7HJcQod7mjh3Sx4NnMga9d9hDGrA
- Save as: telegram_bot_cred

### 3. Import Workflow
- Workflows → "..." menu → Import from File
- Select: /home/ubuntu/n8n_telegram_router_workflow_v2.json
- Click "Activate" toggle

## Test
Send any message to your Telegram bot. It will:
1. Receive via n8n webhook
2. Call pantheon-new Intelligence API
3. Get context from vector DB (217 chunks)
4. Process with Groq LLM
5. Reply to Telegram

## Architecture
```
Telegram → n8n (Router) → pantheon-new (Brain) → Reply
                ↓
          [Future: Gmail, Calendar, Contacts]
```

## Troubleshooting

**Test Intelligence API:**
```bash
curl -X POST http://localhost:3001/api/intelligence/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 65f7a184488e0bccaa23dd83ff114ac9fc7815c834b3e29ab717ba79f7537863" \
  -d '{"query":"test"}'
```

**Check n8n logs:**
```bash
cd /home/ubuntu/pantheon_n8n
docker compose logs -f n8n
```

**Check pantheon-new logs:**
```bash
pm2 logs pantheon-new
```

## Next Steps (Optional)
1. Add Google Calendar integration
2. Add Gmail integration  
3. Add conditional routing for simple queries
4. Add Tasker for Windows webhook
