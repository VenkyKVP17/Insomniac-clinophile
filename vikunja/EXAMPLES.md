# Vikunja NLP - Usage Examples

## Quick Start

### Basic Task Creation

```bash
# Simple task
python3 -m vikunja.nlp.cli "Buy groceries"

# With due date
python3 -m vikunja.nlp.cli "Call mom tomorrow"

# With specific time
python3 -m vikunja.nlp.cli "Meeting with client at 3pm tomorrow"
```

## Advanced Examples

### Priority Levels

```bash
# Using emojis
python3 -m vikunja.nlp.cli "🔴 Fix production bug"
python3 -m vikunja.nlp.cli "🟡 Review PR"

# Using keywords
python3 -m vikunja.nlp.cli "urgent: Call back client"
python3 -m vikunja.nlp.cli "Submit report by Friday critical"
python3 -m vikunja.nlp.cli "Low priority: organize desk"
```

### Projects and Labels

```bash
# Explicit project assignment
python3 -m vikunja.nlp.cli "Study for MBA exam @study"
python3 -m vikunja.nlp.cli "Pay electricity bill @finance"

# Implicit project routing (based on keywords)
python3 -m vikunja.nlp.cli "Apollo duty tomorrow morning"  # → duty project
python3 -m vikunja.nlp.cli "Workout at gym"  # → health project
python3 -m vikunja.nlp.cli "Buy groceries"  # → errands project

# With labels
python3 -m vikunja.nlp.cli "Fix bug in API #backend #urgent"
python3 -m vikunja.nlp.cli "Grocery shopping tomorrow #errands #weekly"
```

### Recurring Tasks

```bash
# Daily tasks
python3 -m vikunja.nlp.cli "Daily standup meeting at 10am"
python3 -m vikunja.nlp.cli "Take medication every day at 8am"

# Weekly tasks
python3 -m vikunja.nlp.cli "Team sync every Monday at 2pm"
python3 -m vikunja.nlp.cli "Weekly review every Friday"

# Custom intervals
python3 -m vikunja.nlp.cli "Water plants every 3 days"
python3 -m vikunja.nlp.cli "Client check-in every 2 weeks"

# Weekday patterns
python3 -m vikunja.nlp.cli "Morning workout every weekday at 6am"
python3 -m vikunja.nlp.cli "Grocery shopping every weekend"
```

### Date and Time Expressions

```bash
# Relative dates
python3 -m vikunja.nlp.cli "Submit assignment tomorrow"
python3 -m vikunja.nlp.cli "Doctor appointment day after tomorrow"
python3 -m vikunja.nlp.cli "Conference next week"

# Specific dates
python3 -m vikunja.nlp.cli "Birthday party on March 25"
python3 -m vikunja.nlp.cli "Exam on 15th April at 9am"

# End of day/week/month
python3 -m vikunja.nlp.cli "Finish report by EOD"
python3 -m vikunja.nlp.cli "Submit timesheet by EOW"
python3 -m vikunja.nlp.cli "Monthly review by EOM"

# Time ranges
python3 -m vikunja.nlp.cli "Conference starting Monday to ending Wednesday"
python3 -m vikunja.nlp.cli "Vacation from Dec 20 to Jan 5"
```

### Complex Real-World Examples

```bash
# MBA student
python3 -m vikunja.nlp.cli "🔴 Submit MBA assignment by Friday EOD @study #urgent"
python3 -m vikunja.nlp.cli "Study for Business Statistics exam next Tuesday @study"
python3 -m vikunja.nlp.cli "Attend webinar tomorrow at 7pm @study #mandatory"

# Hospital duty
python3 -m vikunja.nlp.cli "Apollo duty morning shift tomorrow @duty"
python3 -m vikunja.nlp.cli "Complete ward rounds by 10am @duty"
python3 -m vikunja.nlp.cli "Submit duty roster by 15th @duty #admin"

# Finance management
python3 -m vikunja.nlp.cli "🟠 Pay electricity bill by 25th @finance #bills"
python3 -m vikunja.nlp.cli "Review budget every month on 1st @finance"
python3 -m vikunja.nlp.cli "Tax filing deadline April 31 critical @finance"

# Personal care
python3 -m vikunja.nlp.cli "Haircut this weekend #grooming"
python3 -m vikunja.nlp.cli "Dentist appointment next Tuesday at 10am #health"
python3 -m vikunja.nlp.cli "Workout every weekday at 6am @health #fitness"
```

## CLI Commands

### Task Management

```bash
# List all tasks
python3 -m vikunja.nlp.cli --list

# List tasks in specific project
python3 -m vikunja.nlp.cli --list --project Study

# Search tasks
python3 -m vikunja.nlp.cli --search "groceries"
python3 -m vikunja.nlp.cli --search "MBA"

# Show overdue tasks
python3 -m vikunja.nlp.cli --overdue

# Mark task as done
python3 -m vikunja.nlp.cli --done 123

# Delete task
python3 -m vikunja.nlp.cli --delete 456
```

### Batch Operations

```bash
# Import from file
cat << EOF | python3 -m vikunja.nlp.cli --stdin
Buy groceries tomorrow #errands
Call mom at 6pm
Submit report by Friday urgent @work
Daily standup at 10am every weekday
EOF

# Dry run (parse without creating)
python3 -m vikunja.nlp.cli --dry-run "Submit assignment by Friday @study"

# Output as JSON
python3 -m vikunja.nlp.cli --json "Meeting tomorrow at 3pm"
```

## Telegram Integration

### Commands

```
/task Buy groceries tomorrow at 5pm #errands
/task 🔴 Submit MBA assignment by Friday EOD @study
/tasks
/overdue
```

### Inline Task Creation

You can also create tasks without the `/task` command:

```
task: Call mom tomorrow at 6pm
reminder: Weekly team meeting every Monday at 2pm
todo: Pay electricity bill by 25th
```

### Interactive Buttons

After creating a task, you'll see interactive buttons:
- ✅ Mark Done
- 👁️ View
- 🗑️ Delete

## Discord Integration

### Slash Commands

```
/task description:Buy groceries tomorrow at 5pm #errands
/tasks
/tasks include_done:true limit:20
/overdue
/search query:groceries
/done task_id:123
```

## Nuxt API Integration

### Parse Natural Language

```javascript
// POST /api/vikunja/parse
const response = await fetch('/api/vikunja/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Buy groceries tomorrow at 5pm #errands'
  })
});

const { data } = await response.json();
console.log(data);
// {
//   title: "Buy groceries",
//   due_date: "2026-03-22T11:30:00Z",
//   priority: 0,
//   labels: [{title: "errands"}],
//   ...
// }
```

### Create Task

```javascript
// POST /api/vikunja/create
const response = await fetch('/api/vikunja/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '🔴 Submit assignment by Friday urgent @study'
  })
});

const { data } = await response.json();
console.log(`Task #${data.id} created!`);
```

### List Tasks

```javascript
// GET /api/vikunja/tasks
const response = await fetch('/api/vikunja/tasks');
const { data: tasks } = await response.json();

// With filters
const response2 = await fetch('/api/vikunja/tasks?project=Study');
const response3 = await fetch('/api/vikunja/tasks?search=groceries');
```

## Python API

```python
from vikunja.nlp import VikunjaEngine, VikunjaClient

# Initialize
client = VikunjaClient()
engine = VikunjaEngine(vikunja_client=client)

# Parse only
parsed = engine.parse("Buy groceries tomorrow at 5pm #errands")
print(parsed)

# Parse and create
task = engine.create_task("Submit report by Friday urgent @work")
print(f"Created task #{task['id']}: {task['title']}")

# List tasks
tasks = client.list_tasks()
for task in tasks:
    print(f"[{task['id']}] {task['title']}")

# Search
results = client.search_tasks("groceries")

# Mark done
client.mark_done(123)

# Get overdue
overdue = client.get_overdue_tasks()
```

## Tips and Tricks

### Smart Defaults

1. **Time inference**: If you don't specify a time, it defaults to 9:00 AM IST
2. **Automatic reminders**: Tasks with due dates get a 30-minute advance reminder
3. **Project routing**: Keywords automatically route to the right project
4. **Priority detection**: Emojis and urgent words set priority automatically

### Best Practices

1. **Be specific with times**: "tomorrow at 5pm" is better than "tomorrow"
2. **Use projects**: Organize with @project mentions or keywords
3. **Add labels**: Use #hashtags for easy filtering
4. **Set priorities**: Use emojis or keywords (urgent, critical, etc.)
5. **Recurring tasks**: Specify the pattern clearly (daily, weekly, every X days)

### Common Patterns

```bash
# Apollo duty patterns
"Apollo duty morning shift tomorrow @duty"
"Apollo duty A shift on 24th @duty"
"Apollo duty week off from Mon to Fri @duty"

# MBA study patterns
"Study chapter 5 tonight @study"
"MBA exam on March 21 at 8:30am @study #important"
"Submit assignment by Friday EOD @study #urgent"

# Finance patterns
"Pay rent on 1st every month @finance #recurring"
"Electricity bill due by 25th @finance"
"Review expenses EOW @finance"

# Health patterns
"Workout every weekday at 6am @health #fitness"
"Doctor appointment next Tuesday @health"
"Daily medication at 8am and 8pm @health #recurring"
```
