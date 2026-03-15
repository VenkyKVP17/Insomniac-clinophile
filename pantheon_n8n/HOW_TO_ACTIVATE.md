# 🎯 How to Activate the 3 New Pantheon Workflows

## Current Status

✅ **Workflows are imported** and visible in n8n UI
⏸️  **Workflows are inactive** (waiting for your activation)

---

## Step-by-Step Activation Guide

### 1. Open n8n UI
Go to: **https://n8n-nyx.katthan.online**

---

### 2. You Should See These 3 NEW Workflows (Inactive):

| Workflow Name | Purpose | Status |
|--------------|---------|--------|
| **Pantheon: NYX Telegram Master** | Full Telegram bot with AI | ⏸️  Inactive |
| **Pantheon: GitHub Vault Sync** | Auto-sync vault from GitHub | ⏸️  Inactive |
| **Pantheon: Smart Notification Dispatcher v2** | Smart notifications (6am & 9:30pm) | ⏸️  Inactive |

---

### 3. Activate Each Workflow

#### For "Pantheon: NYX Telegram Master"
1. Click on the workflow name
2. Review the workflow (optional - it's safe!)
3. Click the **"Active"** toggle switch in the top-right corner
4. Wait for green checkmark ✅
5. **Important:** Look for the webhook URL in the logs:
   - Should show: `Webhook registered: pantheon-telegram`

#### For "Pantheon: GitHub Vault Sync"
1. Click on the workflow name
2. Click the **"Active"** toggle switch
3. Wait for green checkmark ✅
4. **Important:** Look for the webhook URL:
   - Should show: `Webhook registered: pantheon-github-sync`

#### For "Pantheon: Smart Notification Dispatcher v2"
1. Click on the workflow name
2. Click the **"Active"** toggle switch
3. Wait for green checkmark ✅
4. **Important:** This uses a cron schedule (not webhook)
   - Should activate without issues

---

## Verification

After activating all 3, check the Docker logs:

```bash
docker logs pantheon_n8n --tail 20
```

**You should see:**
```
Activated workflow "Pantheon: NYX Telegram Master"
Activated workflow "Pantheon: GitHub Vault Sync"
Activated workflow "Pantheon: Smart Notification Dispatcher v2"
```

---

## Test It!

### Test 1: Telegram Bot
Send to your Telegram bot:
```
Hey NYX, test
```

**Expected:** NYX responds with AI-powered reply

---

### Test 2: GitHub Sync (After configuring webhook)
```bash
cd /home/ubuntu/vp
echo "Test sync" >> test.md
git add test.md && git commit -m "Test" && git push
```

**Expected:** Telegram message about vault changes

---

## Troubleshooting

### ❌ "Workflow not found" or workflows don't appear
**Solution:**
```bash
cd /home/ubuntu/pantheon_n8n
docker compose restart
```
Wait 30 seconds, refresh browser

---

### ❌ Webhook not registered after activation
**Solution:**
1. Click the workflow
2. Click "Execute Workflow" once (bottom left)
3. Then toggle "Active" on

---

### ❌ Telegram still says 404
**Solution:**
1. Make sure "Pantheon: NYX Telegram Master" is activated
2. Check logs: `docker logs pantheon_n8n | grep "pantheon-telegram"`
3. Re-verify Telegram webhook:
```bash
curl "https://api.telegram.org/bot8060661071:AAGAPZg7HJcQod7mjh3Sx4NnMga9d9hDGrA/getWebhookInfo"
```

---

## Current Workflow Status in Database

```
ACTIVE (Already Working):
✅ Pantheon Master Agent (Gemini Pro)
✅ Pantheon Master Agent (Local CLI Brain)
✅ Pantheon: Location Logic (Tasker)
✅ Pantheon: Master Triage (Telegram)
✅ Pantheon: Smart Notification Dispatcher (old)
✅ Pantheon: System Health Watcher

INACTIVE (Need Your Activation):
⏸️  Pantheon: NYX Telegram Master ← NEW!
⏸️  Pantheon: GitHub Vault Sync ← NEW!
⏸️  Pantheon: Smart Notification Dispatcher v2 ← NEW!
```

---

## Why Manual Activation?

n8n requires webhook workflows to be manually activated via UI to:
1. **Register webhook endpoints** properly
2. **Validate workflow structure** before going live
3. **Security best practice** - review before activation

This is normal and expected! ✅

---

## After Activation

Once all 3 are active:

1. ✅ Telegram bot will work via n8n
2. ✅ GitHub pushes will trigger vault sync (after webhook configured)
3. ✅ Notifications will batch at 6am & 9:30pm IST

---

**Ready to activate?** Open https://n8n-nyx.katthan.online and flip those switches! 🚀
