# Quick Guide: Two-Way Email Sync

## ✅ System is Built and Deployed!

The two-way email sync system is now running on pantheon-new!

## 🚀 Next Steps

### 1. Import the Gmail Send Workflow to n8n

```bash
# The workflow file is ready at:
/home/ubuntu/n8n_workflows/06_send_email.json
```

**Steps**:
1. Open https://n8n-nyx.katthan.online
2. Workflows → Add Workflow
3. ⋮ → Import from File
4. Select `06_send_email.json`
5. Configure **Gmail OAuth2** credential
6. **Activate** the workflow

### 2. Test the Intent Detection (Current Setup)

The smart handler is available at:
```
POST https://nyx.katthan.online/api/telegram/handle-message
```

**Test it** by sending to Telegram:
```
"Email test@example.com saying hello world"
```

If using the **existing Telegram webhook** (`/api/webhook/telegram`), the basic system works but won't have intent detection yet.

### 3. Enable Smart Intent Detection (Optional)

To fully activate the two-way sync, update your Telegram webhook:

```bash
# Get your token
TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN /home/ubuntu/pantheon-new/.env | cut -d'=' -f2)

# Update webhook to smart handler
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://nyx.katthan.online/api/telegram/handle-message",
    "allowed_updates": ["message", "callback_query"]
  }'
```

## 📝 Example Usage

Once fully set up:

**You**: "Email my boss about the project update. Tell him we're on track for Friday delivery."

**NYX**:
```
✉️ Composing email...

📧 EMAIL DRAFT

To: boss@company.com
Subject: Project Update

Message:
Hi [Boss Name],

I wanted to update you on the project status. We're on track for Friday
delivery as planned. All milestones are being met and the team is working
well.

Best regards,
VPK

───────────────────
• SEND - Send this email
• EDIT - Make changes
• CANCEL - Don't send
```

**You**: "SEND"

**NYX**: "✅ Email sent successfully to boss@company.com!"

## 🔧 System Components

### What's Running
- ✅ **pantheon-new** - Intent detection + email composition
- ✅ **Vector DB** - Context search for better emails
- ✅ **Groq API** - Fast AI email composition
- ⏳ **n8n workflow** - Gmail send (needs import)

### API Endpoints
- `/api/telegram/handle-message` - Smart handler with intent detection
- `/api/webhook/telegram` - Original handler (still works)
- `/api/memory/ingest` - Memory ingestion (working)

### n8n Workflows
- ✅ `01_gmail_to_memory.json` - Inbound emails
- ✅ `02_calendar_to_memory.json` - Calendar sync
- ✅ `03_tasks_to_memory.json` - Tasks sync
- ⏳ `06_send_email.json` - **Outbound emails** (import this!)

## 🎯 What Works Right Now

### Current State (Without n8n Send Workflow)
- ✅ Intent detection from natural language
- ✅ AI email composition with vault context
- ✅ Email draft creation
- ✅ Confirmation flow UI
- ❌ **Actual sending** (needs n8n workflow)

### After Importing n8n Workflow
- ✅ **Everything** works end-to-end!
- ✅ Send emails from Telegram
- ✅ Automatic archival to memory
- ✅ Two-way sync complete

## 📚 Full Documentation

For complete details, see:
- [TWO_WAY_EMAIL_SYNC.md](TWO_WAY_EMAIL_SYNC.md:1) - Complete guide
- [n8n_workflows/README.md](n8n_workflows/README.md:1) - Workflow imports
- [DATA_SYNC_SUMMARY.md](DATA_SYNC_SUMMARY.md:1) - Overall system

## 🐛 Troubleshooting

### Check if Smart Handler is Working
```bash
curl -X POST http://localhost:3001/api/telegram/handle-message \
  -H "Content-Type: application/json" \
  -d '{
    "message": {"text": "email test@example.com saying hello"},
    "userId": "123"
  }'
```

Should return: `{"success":true,"action":"email_draft_created"}`

### Check Logs
```bash
pm2 logs pantheon-new | grep "TELEGRAM-SMART"
```

### Verify Build
```bash
ls -lh /home/ubuntu/pantheon-new/.output/server/chunks/routes/api/telegram/
```

Should show: `handle-message.post.mjs`

## ✅ Summary

**Status**: System built and deployed ✅
**Next**: Import n8n workflow to enable sending
**Then**: Update Telegram webhook to activate smart features

🎉 You're 95% there! Just import the n8n workflow and you're done!
