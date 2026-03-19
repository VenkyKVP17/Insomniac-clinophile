# NYX Priority-Based Notification System

## Overview

NYX uses an intelligent priority-based notification system that balances urgency with user attention. Not all notifications are equal - some require immediate action, while others can wait for appropriate digest windows.

## Priority Levels

### P0: 🚨 CRITICAL
**Sent: Instantly** (bypasses queue)

**Use cases:**
- Urgent deadlines (today)
- Emergency situations
- Critical system failures
- Time-sensitive opportunities

**Keywords that trigger P0:**
- urgent, critical, asap, immediately
- deadline today, emergency

**Example:**
```
File: "00-Daily_Notes/Mar 10, 2026.md"
Content: "URGENT: Submit report by 5 PM today!"

Result: Instant Telegram notification
🚨 CRITICAL ALERT
Submit report by 5 PM today - deadline is in 3 hours!
Source: 00-Daily_Notes/Mar 10, 2026.md
```

---

### P1: ⚠️ HIGH
**Sent: Next dispatch window** (batched)

**Use cases:**
- Important tasks
- Action required soon
- Deadlines tomorrow
- High-priority updates

**Keywords that trigger P1:**
- important, action required, needs attention
- deadline tomorrow, high priority

**Example:**
```
File: "02-Projects/ACE 3.0.md"
Content: "Important: Review project proposal before tomorrow's meeting"

Result: Queued, sent in next dispatch (6-7 AM or 9:30-10:30 PM)
```

---

### P2: ✅ INFO
**Sent: Morning/evening digest** (batched)

**Use cases:**
- General updates
- Finance notifications
- Event reminders
- FYI items

**Triggers:**
- Finance folder updates
- Event folder updates
- Keywords: update, note, reminder, fyi

**Example:**
```
File: "04-Finance/transactions.csv"
Content: Updated with 5 new transactions

Result: Queued for morning/evening digest
```

---

### P3: 🔄 STATUS
**Sent: Morning/evening digest** (batched)

**Use cases:**
- Status updates
- General logs
- Non-urgent information

**Example:**
```
File: "06-Agent_Outputs/SYSTEM/run_history.jsonl"
Content: Agent completed 12 tasks successfully

Result: Queued for morning/evening digest
```

## Dispatch Windows

### Morning Digest
**Time:** 6:00 - 7:00 AM IST

**Content:**
- All P1/P2/P3 messages from previous night
- AI-generated summary
- Prioritized by importance

**Purpose:**
- Start day with awareness of overnight activity
- Review non-urgent items
- Plan daily actions

### Evening Digest
**Time:** 9:30 - 10:30 PM IST

**Content:**
- All P1/P2/P3 messages from the day
- AI-generated summary
- Prioritized by importance

**Purpose:**
- Review day's activity
- Note any pending items
- Prepare for next day

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│         File Change (GitHub Webhook)                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│           Agent Loop (agent.ts)                     │
│  • Read file content                                 │
│  • Analyze with NYX LLM                              │
│  • Determine priority                                │
└──────────────────┬──────────────────────────────────┘
                   │
            ┌──────┴──────┐
            │             │
            ▼             ▼
    ┌──────────┐    ┌─────────────────┐
    │    P0    │    │   P1/P2/P3      │
    │ CRITICAL │    │   Queue         │
    └────┬─────┘    └────┬────────────┘
         │               │
         │               ▼
         │      ┌─────────────────────┐
         │      │  Wait for dispatch  │
         │      │  window             │
         │      └────┬────────────────┘
         │           │
         │           ▼
         │      ┌─────────────────────┐
         │      │  Dispatch Endpoint  │
         │      │  (nyx/dispatch)     │
         │      │  • Generate digest  │
         │      │  • Batch send       │
         │      └────┬────────────────┘
         │           │
         └───────────┴─────────────────┐
                                       ▼
                        ┌──────────────────────────┐
                        │   Telegram Message       │
                        │   to VPK                 │
                        └──────────────────────────┘
```

## API Endpoints

### 1. POST /api/internal/report
**Purpose:** Enqueue messages from agents

**Auth:** X-Pantheon-Key header

**Body:**
```json
{
  "pa_name": "NYX",
  "priority": 2,
  "message": "Finance folder updated with 5 new transactions",
  "action_url": "https://...",
  "action_label": "View Transactions"
}
```

**Response:**
```json
{
  "success": true,
  "queued": true,
  "dispatched": false,
  "id": 1710012345
}
```

**For P0 Critical:**
```json
{
  "success": true,
  "queued": false,
  "dispatched": true,
  "message": "Critical alert sent immediately."
}
```

---

### 2. POST /api/nyx/dispatch
**Purpose:** Dispatch batched messages (called by cron)

**Auth:** X-Pantheon-Key header

**Body (optional):**
```json
{
  "force": true  // Override time window check
}
```

**Response:**
```json
{
  "success": true,
  "dispatched": true,
  "count": 7
}
```

**Outside Window:**
```json
{
  "success": true,
  "dispatched": false,
  "reason": "Outside dispatch window. Use { force: true } to override."
}
```

---

### 3. POST /api/notify
**Purpose:** Direct Telegram notification (legacy, for compatibility)

**Auth:** X-Pantheon-Key header

**Body:**
```json
{
  "pa_name": "HERMES",
  "message": "Task complete!",
  "action_url": "https://...",
  "action_label": "View Report"
}
```

## Priority Detection Algorithm

```typescript
function determinePriority(insight: string, filePath: string): 0 | 1 | 2 | 3 {
    const lowerInsight = insight.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    // P0: Critical
    if (lowerInsight.match(/urgent|critical|asap|immediately|deadline.*today|emergency/)) {
        return 0;
    }

    // P1: High
    if (lowerInsight.match(/important|action required|needs attention|deadline.*tomorrow|high priority/)) {
        return 1;
    }

    // P2: Info
    if (lowerPath.includes('finance') || lowerPath.includes('events') ||
        lowerInsight.match(/update|note|reminder|fyi/)) {
        return 2;
    }

    // P3: Status (default)
    return 3;
}
```

## Database Schema

**Table:** `nyx_queue.json`

```typescript
interface NyxMessage {
  id?: number;
  created_at: string;
  pa_name: string;
  priority: 0 | 1 | 2 | 3;  // Priority level
  message: string;
  action_url?: string;
  action_label?: string;
  sent_at?: string | null;  // NULL if pending, timestamp if sent
}
```

**Query Examples:**
```typescript
// Get all pending messages
getPendingMessages()

// Get pending high-priority only
getPendingMessages(1)  // P0 and P1

// Mark as sent
markMessagesAsSent([id1, id2, id3])
```

## Cron Schedule

**Setup cron job to call dispatch endpoint:**

```bash
# Edit crontab
crontab -e

# Add these lines:

# Morning dispatch (6:30 AM IST = 1:00 AM UTC)
0 1 * * * curl -X POST -H "X-Pantheon-Key: YOUR_KEY" http://localhost:3000/api/nyx/dispatch

# Evening dispatch (10:00 PM IST = 4:30 PM UTC)
30 16 * * * curl -X POST -H "X-Pantheon-Key: YOUR_KEY" http://localhost:3000/api/nyx/dispatch
```

## AI Digest Generation

When dispatching P1/P2/P3 messages, NYX generates an intelligent digest:

**Input:** Array of queued messages
```json
[
  { "pa_name": "NYX", "priority": 2, "message": "Finance updated..." },
  { "pa_name": "NYX", "priority": 1, "message": "Important meeting..." },
  { "pa_name": "SYSTEM", "priority": 3, "message": "Status: All clear" }
]
```

**Output:** Human-readable digest
```
Good morning, Sir.

⚠️ HIGH PRIORITY
• Important meeting tomorrow at 3 PM - review agenda

✅ INFO
• Finance folder updated with 5 transactions
• Latest: ₹450 transport on Mar 9

🔄 STATUS
• All systems operational
• 12 tasks completed overnight

3 updates from 2 agents
```

## Usage Examples

### Example 1: Critical Deadline

**File change:** `00-Daily_Notes/Mar 10, 2026.md`
```markdown
# March 10, 2026

URGENT: Client presentation at 2 PM today - slides not ready!
```

**NYX Analysis:**
```
"Critical: Client presentation in 4 hours. Immediate preparation needed."
```

**Priority:** P0 (contains "URGENT", "today")

**Result:** Instant Telegram message
```
🚨 CRITICAL ALERT

Client presentation in 4 hours. Immediate preparation needed.

Source: 00-Daily_Notes/Mar 10, 2026.md
```

---

### Example 2: Important Task

**File change:** `02-Projects/Website Redesign.md`
```markdown
# Website Redesign

Important: Review mockups before tomorrow's client call
```

**NYX Analysis:**
```
"Important task: Review mockups before client call tomorrow."
```

**Priority:** P1 (contains "Important", "tomorrow")

**Result:** Queued, sent in next dispatch window

---

### Example 3: Finance Update

**File change:** `04-Finance/transactions.csv`
```csv
date,amount,category
2026-03-10,450,transport
```

**NYX Analysis:**
```
"Finance update: New transaction ₹450 for transport"
```

**Priority:** P2 (finance folder)

**Result:** Queued, sent in morning/evening digest

---

### Example 4: Status Log

**File change:** `06-Agent_Outputs/SYSTEM/run_history.jsonl`
```json
{"timestamp": "2026-03-10T01:00:00Z", "status": "complete", "tasks": 12}
```

**NYX Analysis:**
```
"System status: 12 tasks completed successfully"
```

**Priority:** P3 (default)

**Result:** Queued, sent in morning/evening digest

## Benefits

### 1. Reduced Notification Fatigue
- Not every update interrupts you
- Batching reduces context switching
- Only critical items demand immediate attention

### 2. Smart Prioritization
- AI analyzes content for urgency
- Keyword detection catches time-sensitive items
- Folder-based heuristics (finance, events)

### 3. Optimal Timing
- Morning digest: Start day informed
- Evening digest: Review before bed
- Critical alerts: Always instant

### 4. Contextual Batching
- Related updates grouped together
- AI-generated summaries
- Easy to scan on mobile

## Monitoring

### Check Queue Status
```bash
# View pending messages
cat /home/ubuntu/vp/05-Development/pantheon-server/data/nyx_queue.json | jq '.[] | select(.sent_at == null)'

# Count by priority
cat /home/ubuntu/vp/05-Development/pantheon-server/data/nyx_queue.json | jq '[.[] | select(.sent_at == null)] | group_by(.priority) | map({priority: .[0].priority, count: length})'
```

### Test Dispatch
```bash
# Force dispatch (outside window)
curl -X POST \
  -H "X-Pantheon-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"force": true}' \
  http://localhost:3000/api/nyx/dispatch
```

### Manual Enqueue
```bash
# Test P2 message
curl -X POST \
  -H "X-Pantheon-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pa_name": "TEST",
    "priority": 2,
    "message": "Test info message"
  }' \
  http://localhost:3000/api/internal/report

# Test P0 critical
curl -X POST \
  -H "X-Pantheon-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pa_name": "TEST",
    "priority": 0,
    "message": "Test critical alert"
  }' \
  http://localhost:3000/api/internal/report
```

## Migration Notes

**Removed:**
- `server/utils/autonomous-insights.ts`
- `server/plugins/autonomous-insights.ts`
- Hourly check system
- Simple time-based notifications

**Kept:**
- Priority-based queue system
- `/api/internal/report` endpoint
- `/api/nyx/dispatch` endpoint
- AI digest generation
- Smart batching

**Reason:**
The priority-based system is more sophisticated and flexible. It provides better user experience through intelligent batching while ensuring critical items are never delayed.

---

**Version:** 2.0.0
**Last Updated:** 2026-03-09
**Status:** ✅ Active & Consolidated
