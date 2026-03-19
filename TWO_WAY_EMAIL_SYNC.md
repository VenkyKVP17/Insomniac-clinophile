# Two-Way Email Sync with Smart Intent Detection

## 🎯 What This System Does

Transform NYX into a **smart email assistant** that:
1. **Detects when you want to send an email** from natural language
2. **Composes the email intelligently** using AI + your vault context
3. **Asks for confirmation** before sending
4. **Sends via Gmail** and archives to memory
5. **Syncs all sent emails** back to your memory database

## 🏗️ Architecture

```
You send message to Telegram
        ↓
Intent Detection (email? calendar? task? general?)
        ↓
    [IF EMAIL INTENT]
        ↓
AI composes email using:
  - Your request
  - Vault context (vector search)
  - Professional formatting
        ↓
Shows you the draft with buttons:
  [✅ SEND] [✏️ EDIT] [🚫 CANCEL]
        ↓
    [YOU CLICK SEND]
        ↓
n8n workflow → Gmail API → Email sent!
        ↓
Email archived to memory database
        ↓
You get confirmation ✅
```

## 📝 Example Usage

### Send an Email

**You**: "Email Alice about the project deadline. Tell her we need the report by Friday EOD."

**NYX**:
```
✉️ Composing email...

📧 EMAIL DRAFT

To: alice@company.com
Subject: Project Deadline Update

Message:
Hi Alice,

I wanted to reach out regarding our project deadline. We need the final report
submitted by Friday end of day. Please let me know if you need any assistance
or have any questions.

Best regards,
VPK

───────────────────
Reply:
• SEND - Send this email
• EDIT - Make changes
• CANCEL - Don't send
```

**You**: "SEND"

**NYX**: "✅ Email sent successfully to alice@company.com!"

### Natural Language Examples

All of these will trigger email composition:

- "Send an email to john@example.com about tomorrow's meeting"
- "Email my boss saying I'll be late"
- "Write to the team about the new features"
- "Tell sarah@company.com that the project is done"
- "Compose an email to Mom"

## 🚀 Setup Instructions

### Step 1: Build and Deploy

```bash
cd /home/ubuntu/pantheon-new
npm run build
pm2 restart pantheon-new
```

### Step 2: Import n8n Workflow

1. Open n8n: https://n8n-nyx.katthan.online
2. Import `/home/ubuntu/n8n_workflows/06_send_email.json`
3. Configure **Gmail OAuth2 credential**
4. **Activate** the workflow

After activation, you'll get the webhook URL:
```
https://n8n-nyx.katthan.online/webhook/send-email
```

### Step 3: Update Telegram Webhook

Currently, your Telegram bot uses the standard handler. To enable smart intent detection, you have two options:

#### Option A: Use New Smart Handler (Recommended)

Update your Telegram webhook to use the new smart handler:

```bash
TELEGRAM_BOT_TOKEN="your_token"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://nyx.katthan.online/api/telegram/handle-message",
    "allowed_updates": ["message", "callback_query"]
  }'
```

#### Option B: Keep Existing Handler, Add Intent Detection

I can update the existing `/api/webhook/telegram.post.ts` to include intent detection while keeping all other features.

### Step 4: Test the System

**Test 1: Simple email intent**
```
You: "Email test@example.com saying hello"
```

**Test 2: Complex email with context**
```
You: "Send an email to my team about the Q1 results we discussed yesterday"
```

**Test 3: Email with recipient name**
```
You: "Write to Alice about the project deadline"
```

## 🔧 Configuration

### Environment Variables

Already configured in `.env`:
- `GROQ_API_KEY` - For AI email composition
- `GOOGLE_AI_API_KEY` - For vector search context
- `TELEGRAM_BOT_TOKEN` - For Telegram integration

### n8n Webhook URL

The system expects the send-email webhook at:
```
https://n8n-nyx.katthan.online/webhook/send-email
```

If your n8n is at a different URL, update this in:
- [pantheon-new/server/api/telegram/handle-message.post.ts](pantheon-new/server/api/telegram/handle-message.post.ts:24)

## 🎨 Features

### 1. Intent Detection

Automatically detects when you want to:
- ✉️ Send an email
- 📅 Create a calendar event
- ✅ Add a task
- 💬 Just chat

**Email trigger words**:
- email, mail, send, write to, message
- tell [name] via email
- compose, draft
- Any message with an email address

### 2. Smart Email Composition

The AI composer:
- Extracts recipient from your message
- Generates appropriate subject line
- Writes professional email body
- Uses context from your vault
- Maintains your voice and style

### 3. Confirmation Flow

**Buttons**:
- **✅ SEND** - Send the email immediately
- **✏️ EDIT** - Request changes (future feature)
- **🚫 CANCEL** - Don't send the email

**Keywords** (if buttons don't work):
- Type "SEND", "YES", "CONFIRM", "OK" to send
- Type "CANCEL", "NO", "STOP" to cancel
- Type "EDIT" to request changes

### 4. Memory Archival

All sent emails are automatically saved to memory as:
```
User: [EMAIL SENT] To: alice@example.com
      Subject: Project Deadline Update

NYX: [Email body content]
```

This allows you to:
- Ask "What emails did I send today?"
- Search sent emails: "Did I email Alice about the project?"
- Get context in future conversations

### 5. Context-Aware Composition

The AI uses your vault to compose better emails:
```
You: "Email the team about our discussion on pricing"

→ AI searches your vault for notes on pricing discussions
→ Composes email with relevant context
→ Professional and accurate
```

## 📊 Monitoring

### Check Sent Emails in Memory

```bash
sqlite3 /home/ubuntu/pantheon-new/data/pantheon_vectors.db "
SELECT
  datetime(timestamp) as sent_at,
  substr(user_message, 1, 100) as email_info,
  substr(nyx_response, 1, 150) as body_preview
FROM nyx_memory
WHERE user_message LIKE '[EMAIL SENT]%'
ORDER BY timestamp DESC
LIMIT 10;
"
```

### Check n8n Execution History

1. Open n8n
2. Go to **Executions**
3. Filter by workflow: "Pantheon: Send Email"
4. See success/failure of each email sent

### Check pantheon-new Logs

```bash
pm2 logs pantheon-new | grep -E "TELEGRAM-SMART|EMAIL"
```

## 🐛 Troubleshooting

### Email Not Detected

**Issue**: You asked to send an email but NYX didn't detect it

**Solutions**:
- Use clearer keywords: "send an email to..."
- Include email address: "email john@example.com"
- Check logs: `pm2 logs pantheon-new | grep "Detected intent"`

### Draft But No Send Button

**Issue**: You see the email draft but no buttons

**Solutions**:
- Type "SEND" to confirm
- Type "CANCEL" to abort
- Check Telegram app supports inline buttons

### Email Not Sent

**Issue**: Clicked SEND but email wasn't sent

**Check**:
1. n8n workflow is **activated**
2. Gmail OAuth credential is **valid**
3. n8n execution history shows **success**
4. Check error in: `docker compose logs n8n --tail 50`

### Invalid Email Address

**Issue**: "couldn't compose a proper email"

**Solutions**:
- Include a valid email address in your request
- Or use a name NYX knows (check your contacts in vault)
- Be more specific about the recipient

## 🔐 Security

- ✅ All emails require **confirmation** before sending
- ✅ You see the **complete draft** before it's sent
- ✅ Can **cancel** at any time
- ✅ All data stays on **your server**
- ✅ OAuth credentials secured in **n8n**

## 📈 Future Enhancements

### Phase 2 (Optional)
- **Edit flow**: AI revises draft based on your feedback
- **Templates**: Save common email templates
- **Scheduling**: "Send this tomorrow at 9 AM"
- **Attachments**: "Attach the Q1 report"

### Phase 3 (Optional)
- **Calendar integration**: "Email and schedule a meeting"
- **Multi-recipient**: "Email the entire team"
- **Reply detection**: "Reply to Alice's last email"

## 📚 Files Created

1. **[pantheon-new/server/utils/intent-detector.ts](pantheon-new/server/utils/intent-detector.ts:1)** - Intent detection engine
2. **[pantheon-new/server/utils/gmail-api.ts](pantheon-new/server/utils/gmail-api.ts:1)** - Gmail integration
3. **[pantheon-new/server/utils/conversation-state.ts](pantheon-new/server/utils/conversation-state.ts:1)** - State management for confirmations
4. **[pantheon-new/server/api/telegram/handle-message.post.ts](pantheon-new/server/api/telegram/handle-message.post.ts:1)** - Smart message handler
5. **[n8n_workflows/06_send_email.json](n8n_workflows/06_send_email.json:1)** - Gmail send workflow
6. **[TWO_WAY_EMAIL_SYNC.md](TWO_WAY_EMAIL_SYNC.md:1)** - This documentation

## ✅ Ready to Deploy!

1. Build: `cd /home/ubuntu/pantheon-new && npm run build`
2. Restart: `pm2 restart pantheon-new`
3. Import n8n workflow
4. Test with: "Email test@example.com saying hello world"

🎉 You now have a fully intelligent, two-way email sync system!
