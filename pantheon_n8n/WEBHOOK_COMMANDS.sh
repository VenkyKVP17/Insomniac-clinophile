#!/bin/bash
# Pantheon n8n Webhook Configuration Commands
# Run these to complete the setup

echo "🏛️ Pantheon n8n Webhook Setup"
echo "======================================"
echo ""

# Telegram Webhook Setup
echo "1️⃣  Setting up Telegram Webhook..."
echo ""
curl -X POST "https://api.telegram.org/bot8060661071:AAGAPZg7HJcQod7mjh3Sx4NnMga9d9hDGrA/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://n8n-nyx.katthan.online/webhook/pantheon-telegram",
    "secret_token": "nyx_telegram_secret_vpk_9281"
  }'

echo ""
echo ""
echo "✅ Telegram webhook configured!"
echo ""

# Verify Telegram Webhook
echo "2️⃣  Verifying Telegram Webhook..."
echo ""
curl "https://api.telegram.org/bot8060661071:AAGAPZg7HJcQod7mjh3Sx4NnMga9d9hDGrA/getWebhookInfo"

echo ""
echo ""
echo "======================================"
echo "✅ Telegram Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "  1. Go to n8n UI: https://n8n-nyx.katthan.online"
echo "  2. Import these workflows:"
echo "     - pantheon_telegram_master.json"
echo "     - pantheon_github_sync.json"
echo "     - pantheon_notification_dispatcher.json"
echo ""
echo "  3. Configure GitHub webhook manually:"
echo "     URL: https://n8n-nyx.katthan.online/webhook/pantheon-github-sync"
echo "     Secret: pantheon_secret_99"
echo ""
echo "  4. Test by sending a Telegram message to your bot!"
echo "======================================"
