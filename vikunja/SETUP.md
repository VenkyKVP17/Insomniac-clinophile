# Vikunja NLP - Setup Guide

## Prerequisites

- Python 3.10 or higher
- Vikunja instance running (Docker)
- Groq API key (optional, for LLM fallback)

## Step 1: Verify Vikunja is Running

```bash
# Check if Vikunja is accessible
curl http://localhost:3456/api/v1/info

# You should see JSON output with version info
```

If Vikunja is not running, start it:

```bash
cd /home/ubuntu/vikunja
docker compose up -d  # or: docker-compose up -d
```

## Step 2: Get API Token

1. Open Vikunja web interface: http://localhost:3456 (or your domain)
2. Log in with your credentials
3. Go to Settings → API Tokens
4. Create a new token with full permissions
5. Copy the token (starts with `tk_...`)

## Step 3: Configure Environment Variables

Add to `/home/ubuntu/vp/.env`:

```bash
# Vikunja Configuration
VIKUNJA_API_URL=http://localhost:3456
VIKUNJA_API_TOKEN=tk_your_token_here

# Groq API (optional, for LLM-powered parsing)
GROQ_API=gsk_your_key_here
```

For Pantheon-new (Nuxt), also add to `/home/ubuntu/pantheon-new/.env`:

```bash
VIKUNJA_API_URL=http://localhost:3456
VIKUNJA_API_TOKEN=tk_your_token_here
```

## Step 4: Install Python Dependencies

```bash
pip install groq requests dateparser pyyaml
```

## Step 5: Test the CLI

```bash
# Set environment variables for this session
export VIKUNJA_API_URL=http://localhost:3456
export VIKUNJA_API_TOKEN=tk_your_token_here
export GROQ_API=gsk_your_key_here  # optional

# Test parsing (dry run)
python3 -m vikunja.nlp.cli --dry-run "Buy groceries tomorrow at 5pm"

# Create a test task
python3 -m vikunja.nlp.cli "Test task from NLP"

# List tasks
python3 -m vikunja.nlp.cli --list
```

## Step 6: Create Wrapper Script (Optional)

Create `/home/ubuntu/vp/.scripts/vk` for easy access:

```bash
#!/bin/bash
# Vikunja NLP wrapper script

# Load environment
source /home/ubuntu/vp/.env

# Run CLI
cd /home/ubuntu
python3 -m vikunja.nlp.cli "$@"
```

Make it executable:

```bash
chmod +x /home/ubuntu/vp/.scripts/vk
```

Now you can use it like:

```bash
vk "Buy groceries tomorrow"
vk --list
vk --overdue
```

## Step 7: Telegram Integration (Optional)

If you want Telegram bot integration:

1. **Add Vikunja config to Nuxt runtime:**

Edit `/home/ubuntu/pantheon-new/nuxt.config.ts` and add to `runtimeConfig`:

```typescript
runtimeConfig: {
  // ... existing config
  vikunjaApiUrl: process.env.VIKUNJA_API_URL || 'http://localhost:3456',
  vikunjaApiToken: process.env.VIKUNJA_API_TOKEN || '',
}
```

2. **Restart Pantheon:**

```bash
cd /home/ubuntu/pantheon-new
npm run build
pm2 restart pantheon-new
```

3. **Test Telegram commands:**

In your Telegram bot:
- `/task Buy groceries tomorrow at 5pm`
- `/tasks`
- `/overdue`

## Step 8: Discord Integration (Optional)

For Discord bot integration:

1. **Register slash commands** using the Discord API
2. **Handle interactions** using the DiscordTaskHandler

Example command registration:

```python
from vikunja.nlp.handlers import DiscordTaskHandler

handler = DiscordTaskHandler()
commands = handler.get_slash_commands()

# Use Discord API to register commands
# POST https://discord.com/api/v10/applications/{app_id}/commands
```

## Step 9: Create Projects (Optional)

Create projects in Vikunja web UI to enable auto-routing:

Recommended projects:
- **Inbox** (default)
- **Study** - for MBA/learning tasks
- **Health** - for fitness/medical
- **Finance** - for bills/budgets
- **Duty** - for Apollo hospital shifts
- **Errands** - for shopping/chores
- **Work** - for work tasks
- **Home** - for house tasks

Keywords will automatically route tasks to these projects!

## Troubleshooting

### Error: "Connection refused"

**Problem:** Vikunja is not running

**Solution:**
```bash
cd /home/ubuntu/vikunja
docker compose up -d
```

### Error: "401 Unauthorized"

**Problem:** Invalid or missing API token

**Solution:**
1. Check your token in Vikunja web UI
2. Verify it's correctly set in `.env`
3. Make sure there are no extra spaces in the token

### Error: "No module named vikunja"

**Problem:** Running from wrong directory

**Solution:**
```bash
cd /home/ubuntu
python3 -m vikunja.nlp.cli "task"
```

### Error: "Groq API key not found"

**Problem:** LLM fallback is enabled but no key provided

**Solution:**
- Add `GROQ_API` to your `.env`, OR
- Disable LLM with `--no-llm` flag:
```bash
python3 -m vikunja.nlp.cli --no-llm "task"
```

### Tasks not auto-routing to projects

**Problem:** Project names don't match keywords

**Solution:**
1. Check your project names in Vikunja (case-insensitive)
2. Edit `/home/ubuntu/vikunja/nlp/config.yaml` to add custom hints
3. Use explicit `@project` mentions

### Date parsing not working

**Problem:** Ambiguous date format

**Solution:**
- Be more specific: "tomorrow at 5pm" instead of "tomorrow"
- Use explicit dates: "March 25 at 3pm"
- Use ISO format: "2026-03-25 15:00"

## Integration with CHRONOS

To integrate with your existing CHRONOS agent:

1. **Import Vikunja tasks into daily briefings:**

```python
from vikunja.nlp import VikunjaClient

client = VikunjaClient()
tasks = client.list_tasks()

# Include in briefing
overdue = client.get_overdue_tasks()
if overdue:
    briefing += f"\n⚠️ You have {len(overdue)} overdue tasks:\n"
    for task in overdue[:5]:
        briefing += f"  • {task['title']}\n"
```

2. **Sync Obsidian tasks to Vikunja:**

```python
from vikunja.nlp import VikunjaEngine

engine = VikunjaEngine()

# Read tasks from Obsidian
with open(daily_note_path) as f:
    for line in f:
        if line.startswith("- [ ]"):
            task_text = line[6:].strip()
            engine.create_task(task_text)
```

## Performance Tips

1. **Use project caching**: The engine caches project mappings for 5 minutes
2. **Disable LLM for simple tasks**: Use `--no-llm` flag for faster parsing
3. **Batch operations**: Use `--stdin` for multiple tasks
4. **Use JSON output**: `--json` flag for programmatic parsing

## Next Steps

1. Read [README.md](README.md) for feature overview
2. Check [EXAMPLES.md](EXAMPLES.md) for usage examples
3. Customize `config.yaml` for your needs
4. Create your own project routing rules
5. Set up Discord/Telegram integration

## Support

For issues or questions:
- Check the logs: `/home/ubuntu/vikunja/nlp/logs/nlp.log`
- Test with `--dry-run --no-llm` to isolate issues
- Verify Vikunja API is accessible
