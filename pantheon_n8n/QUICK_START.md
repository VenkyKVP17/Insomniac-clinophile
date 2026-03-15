# 🚀 Pantheon n8n Quick Start

## ✅ What's Done

Your n8n is **fully configured** with all Pantheon features:

1. ✅ Docker container running with all environment variables
2. ✅ Vault, databases, and scripts mounted
3. ✅ 3 new workflows created (Telegram, GitHub, Notifications)
4. ✅ All existing workflows preserved (Chronos, IRIS, HERMES)

---

## 🎯 Your Next 3 Steps (10 minutes)

### Step 1: Configure Telegram Webhook (2 min)

```bash
cd /home/ubuntu/pantheon_n8n
./WEBHOOK_COMMANDS.sh
```

This will:
- Set Telegram webhook to n8n
- Verify the configuration
- Show you the status

---

### Step 2: Import Workflows to n8n (5 min)

1. Open n8n UI: **https://n8n-nyx.katthan.online**

2. Import these 3 files:
   - `pantheon_telegram_master.json` - Telegram bot
   - `pantheon_github_sync.json` - GitHub automation
   - `pantheon_notification_dispatcher.json` - Smart notifications

   **How to import:**
   - Click "Add workflow" → "Import from file"
   - Select the JSON file
   - Click "Activate" toggle to enable it

---

### Step 3: Configure GitHub Webhook (3 min)

1. Go to your vault's GitHub repository
2. **Settings** → **Webhooks** → **Add webhook**
3. Fill in:
   - **Payload URL:** `https://n8n-nyx.katthan.online/webhook/pantheon-github-sync`
   - **Content type:** `application/json`
   - **Secret:** `pantheon_secret_99`
   - **Events:** Just the push event
4. Click **Add webhook**

---

## 🧪 Test It

### Test Telegram Bot:
Send this to your bot:
```
Hey NYX, what's on my schedule?
```

### Test GitHub Sync:
1. Edit any file in your vault
2. Commit and push
3. Check Telegram for NYX's message

---

## 📚 Full Documentation

- **Setup Guide:** `PANTHEON_N8N_SETUP.md` - Complete configuration details
- **Comparison:** `PANTHEON_COMPARISON.md` - What changed and why
- **Webhook Commands:** `WEBHOOK_COMMANDS.sh` - Telegram setup script

---

## 🆘 Need Help?

### Check n8n logs:
```bash
docker logs -f pantheon_n8n
```

### Check if n8n is running:
```bash
docker ps | grep pantheon_n8n
```

### Restart n8n:
```bash
cd /home/ubuntu/pantheon_n8n
docker compose restart
```

---

## 🎉 That's It!

You now have a **hybrid architecture** where:
- **n8n** handles workflows, webhooks, and scheduling
- **Pantheon server** handles AI, databases, and agent logic

**Best of both worlds!**

---

**Questions?** Check `PANTHEON_N8N_SETUP.md` for troubleshooting.
