# Discord Bot Setup for Vikunja Tasks

## Current Status

❌ **Discord bot is NOT currently connected**

The `discord_handler.py` exists but needs:
1. Discord bot token
2. Application ID
3. Slash command registration
4. Webhook/interaction endpoint

## Why /tasks Shows a Popup

Discord treats `/tasks` as a **slash command** that needs:
- Registered options/parameters
- Proper command structure
- API registration with Discord

Unlike Telegram where you can type:
```
/task Buy groceries tomorrow
```

Discord requires:
```
/task description:Buy groceries tomorrow
```

---

## Setup Instructions

### **Step 1: Create Discord Bot (If Not Done)**

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "NYX" or "Vikunja Tasks"
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** (save securely!)
7. Enable these intents:
   - ✅ Message Content Intent
   - ✅ Guild Messages

### **Step 2: Get Application ID**

1. In Discord Developer Portal
2. Go to "General Information"
3. Copy **Application ID**

### **Step 3: Register Slash Commands**

You need to register commands with Discord API. Create this script:

**File: `/home/ubuntu/vp/.scripts/register_discord_commands.py`**

```python
#!/usr/bin/env python3
"""
Register Discord slash commands for Vikunja
"""
import requests
import sys

# REPLACE THESE WITH YOUR VALUES
DISCORD_BOT_TOKEN = "your_bot_token_here"
APPLICATION_ID = "your_application_id_here"
GUILD_ID = "your_server_id_here"  # Optional: for testing in one server

# Slash command definitions
commands = [
    {
        "name": "task",
        "description": "Create a task using natural language",
        "options": [
            {
                "name": "description",
                "description": "Task description (e.g., 'Buy groceries tomorrow at 5pm')",
                "type": 3,  # STRING
                "required": True
            }
        ]
    },
    {
        "name": "tasks",
        "description": "List your tasks",
        "options": [
            {
                "name": "include_done",
                "description": "Include completed tasks",
                "type": 5,  # BOOLEAN
                "required": False
            },
            {
                "name": "limit",
                "description": "Maximum number of tasks to show (default: 10)",
                "type": 4,  # INTEGER
                "required": False
            }
        ]
    },
    {
        "name": "overdue",
        "description": "Show overdue tasks",
        "options": []
    },
    {
        "name": "done",
        "description": "Mark a task as complete",
        "options": [
            {
                "name": "task_id",
                "description": "Task ID to mark as done",
                "type": 4,  # INTEGER
                "required": True
            }
        ]
    },
    {
        "name": "search",
        "description": "Search for tasks",
        "options": [
            {
                "name": "query",
                "description": "Search query",
                "type": 3,  # STRING
                "required": True
            }
        ]
    }
]

# Register commands
headers = {
    "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
    "Content-Type": "application/json"
}

# Choose: Guild (one server) or Global (all servers)
if GUILD_ID:
    url = f"https://discord.com/api/v10/applications/{APPLICATION_ID}/guilds/{GUILD_ID}/commands"
    print(f"Registering commands for guild {GUILD_ID}...")
else:
    url = f"https://discord.com/api/v10/applications/{APPLICATION_ID}/commands"
    print("Registering global commands (takes ~1 hour to propagate)...")

for cmd in commands:
    response = requests.post(url, headers=headers, json=cmd)
    if response.ok:
        print(f"✅ Registered: /{cmd['name']}")
    else:
        print(f"❌ Failed: /{cmd['name']} - {response.text}")

print("\n✅ Command registration complete!")
print("\nNow you can use:")
print("  /task description:Buy groceries tomorrow")
print("  /tasks")
print("  /overdue")
```

**Run it:**
```bash
chmod +x /home/ubuntu/vp/.scripts/register_discord_commands.py
python3 /home/ubuntu/vp/.scripts/register_discord_commands.py
```

### **Step 4: Create Discord Webhook Handler**

**File: `/home/ubuntu/pantheon-new/server/api/webhook/discord.post.ts`**

```typescript
import { defineEventHandler, readBody, createError } from 'h3';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Discord Interactions Webhook
 * Handles slash commands from Discord
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();

  // Verify Discord signature (important for security!)
  const signature = getHeader(event, 'x-signature-ed25519');
  const timestamp = getHeader(event, 'x-signature-timestamp');

  // TODO: Verify signature with your Discord public key
  // For now, just log it
  console.log('[DISCORD] Received interaction:', body.type);

  // Handle Discord PING
  if (body.type === 1) {
    return { type: 1 }; // ACK
  }

  // Handle slash commands
  if (body.type === 2) {
    const commandName = body.data.name;
    const options = body.data.options || [];

    // Convert options to object
    const optionsObj: Record<string, any> = {};
    for (const opt of options) {
      optionsObj[opt.name] = opt.value;
    }

    try {
      // Call Discord handler
      const env = {
        VIKUNJA_API_URL: config.vikunjaApiUrl || 'http://localhost:3456',
        VIKUNJA_API_TOKEN: config.vikunjaApiToken || '',
        GROQ_API: config.groqApi || ''
      };

      const envStr = Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ');

      // Execute Discord handler
      const { stdout } = await execAsync(
        `${envStr} python3 -c "
import sys
sys.path.insert(0, '/home/ubuntu')
from vikunja.nlp.handlers import DiscordTaskHandler
import json

handler = DiscordTaskHandler()
result = handler.handle_slash_command('${commandName}', ${JSON.stringify(optionsObj)})
print(json.dumps(result))
"`,
        { timeout: 10000 }
      );

      const result = JSON.parse(stdout.trim());

      // Convert to Discord interaction response
      return {
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: result.content,
          embeds: result.embeds,
          components: result.components,
          flags: result.ephemeral ? 64 : 0
        }
      };

    } catch (error: any) {
      console.error('[DISCORD] Command error:', error);
      return {
        type: 4,
        data: {
          content: `❌ Error: ${error.message}`,
          flags: 64 // Ephemeral
        }
      };
    }
  }

  return { ok: true };
});
```

### **Step 5: Configure Discord Bot**

Add to `/home/ubuntu/pantheon-new/.env`:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_APPLICATION_ID=your_application_id_here
DISCORD_PUBLIC_KEY=your_public_key_here
```

### **Step 6: Set Interactions Endpoint in Discord**

1. Go to Discord Developer Portal
2. Go to your application
3. General Information → Interactions Endpoint URL
4. Set to: `https://your-domain.com/api/webhook/discord`
5. Discord will verify the endpoint

### **Step 7: Invite Bot to Your Server**

1. In Discord Developer Portal
2. Go to OAuth2 → URL Generator
3. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
4. Select permissions:
   - ✅ Send Messages
   - ✅ Use Slash Commands
5. Copy the generated URL
6. Open in browser and add to your server

---

## Alternative: Use Telegram Instead

**Recommended for now:** Since Telegram is already working perfectly, just use Telegram for task management!

**Why Telegram is easier:**
- ✅ Already integrated and working
- ✅ No command registration needed
- ✅ Natural language friendly
- ✅ Interactive buttons work
- ✅ Less setup overhead

**In Telegram:**
```
/task Buy groceries tomorrow at 5pm
/tasks
/overdue
```

Just works! 🎉

---

## Quick Fix: Disable Discord Slash Command

If you want to stop the popup in Discord:

1. Go to Discord Developer Portal
2. Your Application → Applications Commands
3. Delete the `/tasks` command
4. Or disable the bot in your server

---

## Summary

**Current State:**
- ❌ Discord bot not fully connected
- ✅ Telegram bot works perfectly
- ✅ CLI works great
- ✅ Web API ready

**Recommendation:**
1. **Use Telegram** for now (it's ready and works!)
2. **Set up Discord later** if you really need it (requires more config)
3. **Use CLI** for quick testing

**Discord is more complex** because it requires:
- Command registration with Discord API
- Webhook endpoint setup
- Signature verification
- Specific command formats

**Telegram is simpler** because:
- Just sends text messages
- No registration needed
- Natural language friendly
- Already working in your setup

---

## Need Help?

If you really want Discord working, I can help set it up properly. But honestly, **Telegram + CLI** covers all your needs! 😊
