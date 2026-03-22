# Vikunja NLP - Comprehensive Natural Language Task Management

**VPK's Pantheon** - Personal AI Assistant Ecosystem

A powerful natural language processing engine for Vikunja task management with Telegram, Discord, and Web API integration.

## Features

### 🧠 Advanced NLP Engine
- **Multi-stage parsing** with regex + LLM fallback (Groq Llama-3.3-70b)
- **Entity extraction**: dates, times, priorities, projects, labels, recurrence, reminders
- **Smart defaults**: Auto-fill reasonable values (9am default time, 30min reminders, etc.)
- **Context-aware**: Learns from your patterns and preferences
- **IST timezone** native support

### 📱 Multiple Input Methods
- **Telegram Bot**: Rich messages with inline buttons
- **Discord Bot**: Slash commands with embeds and components
- **Web API**: RESTful endpoints for Nuxt/web integration
- **CLI**: Command-line tool for scripting and testing

### 🎯 Smart Features
- **Priority detection**: From emojis (🔴🟠🟡🟢) and keywords (urgent, critical, etc.)
- **Project routing**: Auto-detect projects from keywords (finance, health, duty, etc.)
- **Recurring tasks**: Complex patterns (daily, every 2 weeks, weekdays only, etc.)
- **Date intelligence**: Handles relative dates, ranges, EOD/EOW/EOM
- **Conflict detection**: Integrates with Apollo duty schedule (via CHRONOS)

## Installation

### Prerequisites
```bash
# Python 3.10+ required
python3 --version

# Install dependencies
pip install groq requests dateparser pyyaml
```

### Configuration

1. **Copy and edit environment variables:**
```bash
# Already set in /home/ubuntu/vp/.env
VIKUNJA_API_URL=http://localhost:3456
VIKUNJA_API_TOKEN=your_token_here
GROQ_API=your_groq_key_here
```

2. **Edit config if needed:**
```bash
nano /home/ubuntu/vikunja/nlp/config.yaml
```

## Usage

### CLI Tool

```bash
# Basic usage (create task)
python3 -m vikunja.nlp.cli "Buy groceries tomorrow at 5pm #errands"

# Dry run (parse only, don't create)
python3 -m vikunja.nlp.cli --dry-run "Submit report by Friday urgent @work"

# List all tasks
python3 -m vikunja.nlp.cli --list

# List tasks in specific project
python3 -m vikunja.nlp.cli --list --project Study

# Search tasks
python3 -m vikunja.nlp.cli --search "groceries"

# Mark task as done
python3 -m vikunja.nlp.cli --done 123

# Show overdue tasks
python3 -m vikunja.nlp.cli --overdue

# Batch import from file
cat tasks.txt | python3 -m vikunja.nlp.cli --stdin

# Disable LLM (regex only)
python3 -m vikunja.nlp.cli --no-llm "Daily standup at 10am"
```

### Python API

```python
from vikunja.nlp import VikunjaEngine, VikunjaClient

# Initialize
client = VikunjaClient()
engine = VikunjaEngine(vikunja_client=client)

# Parse natural language
parsed = engine.parse("Buy groceries tomorrow at 5pm #errands")
print(parsed)

# Create task
result = engine.create_task("Submit report by Friday urgent @work")
print(f"Created task #{result['id']}")

# List tasks
tasks = client.list_tasks()
for task in tasks:
    print(f"[{task['id']}] {task['title']}")
```

### Telegram Integration

```python
from vikunja.nlp.handlers import TelegramTaskHandler

handler = TelegramTaskHandler()

# Handle /task command
response = handler.handle_message("/task Buy groceries tomorrow at 5pm")
print(response["text"])
# Outputs: "✅ Task Created\n\n*Title:* Buy groceries\n..."

# Handle inline task creation
response = handler.handle_message("task: Call mom today at 6pm")

# List tasks
response = handler.handle_message("/tasks")

# Handle button callback
response = handler.handle_callback("task_done:123")
```

### Discord Integration

```python
from vikunja.nlp.handlers import DiscordTaskHandler

handler = DiscordTaskHandler()

# Handle /task slash command
response = handler.handle_slash_command(
    "task",
    {"description": "Buy groceries tomorrow at 5pm #errands"}
)
print(response["embeds"][0])

# Handle /tasks command
response = handler.handle_slash_command("tasks", {})

# Get command definitions for registration
commands = handler.get_slash_commands()
```

## Natural Language Examples

### Basic Tasks
```
"Buy groceries"
"Call mom tomorrow"
"Submit report by Friday"
```

### With Times
```
"Meeting tomorrow at 3pm"
"Dentist appointment next Tuesday at 10am"
"Workout today at 6pm"
```

### With Priorities
```
"🔴 Fix production bug"
"urgent: Call back client"
"Submit assignment by Monday high priority"
```

### With Projects and Labels
```
"Pay electricity bill @finance #bills"
"Study for MBA exam @study"
"Apollo duty tomorrow #hospital"
```

### Recurring Tasks
```
"Daily standup meeting at 10am"
"Weekly team sync every Monday at 2pm"
"Pay rent on 1st of every month"
"Workout every weekday at 6am"
```

### Date Ranges
```
"Conference from Monday to Wednesday"
"Vacation starting Dec 20 to Jan 5"
```

### Complex Examples
```
"🔴 Submit MBA assignment by Friday EOD @study #urgent"
"Remind me to call mom every Sunday at 9am"
"Daily medication at 8am and 8pm starting tomorrow"
"Team meeting next Tuesday at 3pm high priority @work"
```

## API Endpoints (Nuxt)

Will be created at:

- `POST /api/vikunja/parse` - Parse natural language
- `POST /api/vikunja/create` - Create task from NL
- `GET /api/vikunja/tasks` - List tasks
- `PATCH /api/vikunja/tasks/:id` - Update task
- `DELETE /api/vikunja/tasks/:id` - Delete task

## Integration with Pantheon

### CHRONOS Agent
- Syncs Vikunja tasks to/from Obsidian daily notes
- Includes tasks in morning/evening briefings
- Detects Apollo duty conflicts

### NYX Telegram
- `/task` command for quick task creation
- Inline task parsing from conversations
- Interactive task management

### Memory Store
- Uses context for intelligent parsing
- Learns your patterns and preferences

## Architecture

```
vikunja/nlp/
├── __init__.py           # Main exports
├── engine.py             # Core NLP engine
├── api_client.py         # Vikunja API wrapper
├── cli.py                # CLI tool
├── config.yaml           # Configuration
├── parsers/
│   ├── date_parser.py    # Date/time extraction
│   ├── priority_parser.py # Priority detection
│   ├── project_parser.py  # Project routing
│   └── recurrence_parser.py # Recurrence patterns
├── llm/
│   ├── groq_client.py    # Groq API client
│   └── prompts.py        # LLM prompts
└── handlers/
    ├── telegram_handler.py # Telegram integration
    └── discord_handler.py  # Discord integration
```

## Troubleshooting

### "No module named vikunja"
```bash
# Run from parent directory
cd /home/ubuntu
python3 -m vikunja.nlp.cli "task"
```

### "Groq API key not found"
```bash
# Set in environment
export GROQ_API="your_key_here"

# Or disable LLM
python3 -m vikunja.nlp.cli --no-llm "task"
```

### "Connection refused"
```bash
# Check Vikunja is running
curl http://localhost:3456/api/v1/info

# Start Vikunja
cd /home/ubuntu/vikunja
docker-compose up -d
```

## License

Personal use only - VPK's Pantheon

## Credits

Built by Claude (Anthropic) for VPK's personal AI assistant ecosystem.
