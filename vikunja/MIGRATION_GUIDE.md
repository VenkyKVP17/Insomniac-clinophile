# NYX Sub-Agents → Vikunja Migration Guide

**Status:** ✅ COMPLETE
**Date:** March 21, 2026

## Overview

Successfully migrated all NYX sub-agents (CHRONOS, AIAS, briefing system) from reading Obsidian daily notes to using **Vikunja** as the single source of truth for tasks and calendar events.

## What Changed

### ✅ **Before (Obsidian-based)**
- Tasks scattered across daily notes (`00-Daily_Notes/*.md`)
- Manual parsing of Markdown checkboxes
- No centralized task management
- Limited querying capabilities
- No priority/project organization

### ✅ **After (Vikunja-based)**
- All tasks centralized in Vikunja
- Structured data with priority, projects, labels
- Advanced querying (overdue, high-priority, by project)
- Natural language task creation
- Telegram/Discord/Web API integration
- Smart reminders and recurrence

---

## New Files Created

### **Python Utilities**
1. **`/home/ubuntu/vp/.scripts/vikunja_helper.py`** (238 lines)
   - Core helper for all agents
   - Methods: `get_tasks_today()`, `get_tasks_overdue()`, `get_tasks_by_priority()`, etc.
   - Formatting utilities for Telegram display
   - CLI for manual testing

2. **`/home/ubuntu/vp/.scripts/chronos_tasks_vikunja.py`** (69 lines)
   - Replaces `chronos_tasks.py`
   - Lists today's and overdue tasks from Vikunja
   - Supports marking tasks as done via Vikunja API
   - Compatible with existing Telegram button format

3. **`/home/ubuntu/vp/.scripts/aias_sentinel_vikunja.py`** (76 lines)
   - Replaces `aias_sentinel.py`
   - Reports on task statistics from Vikunja
   - Filters: high-priority, overdue, today
   - Interactive buttons for quick actions

### **TypeScript/Nuxt Utilities**
4. **`/home/ubuntu/pantheon-new/server/utils/vikunja-briefing.ts`** (158 lines)
   - Fetches task summary from Vikunja for briefings
   - Formats tasks for display in morning/evening briefings
   - Integrates with existing briefing system

---

## Updated Files

### **1. Briefing System**
**File:** `/home/ubuntu/pantheon-new/server/utils/briefings.ts`

**Changes:**
- Added import: `import { getVikunjaTaskSummary, generateTaskSection } from './vikunja-briefing'`
- Replaced Obsidian task queries with `getVikunjaTaskSummary()`
- Enhanced task display with detailed Vikunja data
- Shows task priorities, due times, and projects

**New Briefing Format:**
```
🌅 Good morning, Sir.

Today is Thursday, Mar 21, 2026
Current time: 08:00 AM IST

⚠️ Overdue Tasks (2):
  • 🔴 Submit MBA assignment [Due: 18:00]
  • 🟡 Pay electricity bill @finance

📋 Tasks Due Today (3):
  • 🟢 Buy groceries [Due: 17:00] @errands
  • Apollo duty morning shift [Due: 08:00] @duty
  • Call mom [Due: 18:00]

🔥 High Priority (1):
  • 🔴 Fix production bug @work
```

### **2. Agent Registry**
**File:** `/home/ubuntu/pantheon-new/server/config/agent-registry.ts`

**Changes:**
```typescript
'tasks': {
    name: 'AIAS',
    command: '/tasks',
    script: '.scripts/aias_sentinel_vikunja.py',  // ← Changed
    description: 'View actionable tasks from Vikunja',  // ← Updated
    emoji: '🛡️',
    category: 'Schedule',
    buttons: [
        { text: '🔴 High Priority', callback_data: 'view:tasks_high' },
        { text: '⌛ Overdue', callback_data: 'view:tasks_overdue' }
    ]
},
```

### **3. Telegram Webhook Handler**
**File:** `/home/ubuntu/pantheon-new/server/api/webhook/telegram.post.ts`

**Changes:**
- Updated `view:tasks_high` and `view:tasks_overdue` callbacks
- Now uses `aias_sentinel_vikunja.py` with Vikunja credentials
- Passes `VIKUNJA_API_URL` and `VIKUNJA_API_TOKEN` to scripts

---

## How to Use

### **1. Telegram Commands (No Changes)**

All existing commands work the same:

```
/tasks              → View all active tasks
/chronos            → CHRONOS briefing (uses Vikunja)
```

Button callbacks also work:
- "🔴 High Priority" → Shows high-priority from Vikunja
- "⌛ Overdue" → Shows overdue from Vikunja
- "✅ Mark Done" → Marks task complete in Vikunja

### **2. CLI (New)**

Test directly from command line:

```bash
# View summary
python3 /home/ubuntu/vp/.scripts/vikunja_helper.py summary

# View today's tasks
python3 /home/ubuntu/vp/.scripts/vikunja_helper.py today

# View overdue
python3 /home/ubuntu/vp/.scripts/vikunja_helper.py overdue

# View high-priority
python3 /home/ubuntu/vp/.scripts/vikunja_helper.py high

# View by project
python3 /home/ubuntu/vp/.scripts/vikunja_helper.py project --project Study
```

### **3. Morning/Evening Briefings**

Automatically includes Vikunja tasks:
- **Morning briefing** → Shows overdue + today's tasks
- **Evening briefing** → Shows completed today + tomorrow's tasks
- **Catch-up briefing** → Post-duty summary with pending tasks

---

## Migration Checklist

- [x] Created `vikunja_helper.py` with core utilities
- [x] Created `chronos_tasks_vikunja.py` (CHRONOS replacement)
- [x] Created `aias_sentinel_vikunja.py` (AIAS replacement)
- [x] Created `vikunja-briefing.ts` for Nuxt integration
- [x] Updated `briefings.ts` to use Vikunja
- [x] Updated agent registry to point to new scripts
- [x] Updated Telegram webhook callbacks
- [x] Tested all integrations
- [x] Verified backward compatibility

---

## Testing Results

### ✅ CHRONOS Tasks
```bash
$ python3 chronos_tasks_vikunja.py list
✅ You have no open tasks for today. Well done, Sir.
```

### ✅ AIAS Sentinel
```bash
$ python3 aias_sentinel_vikunja.py
🛡️ *AIAS | Sentinel Active*

Total Active Tasks: 4
📅 Upcoming (7 days): 1
🔥 High Priority: 1

*Quick Actions:*
[BUTTON|view:tasks_high] 🔥 View High Priority
[BUTTON|view:tasks_overdue] ⚠️ View Overdue
```

### ✅ Vikunja Helper
```bash
$ python3 vikunja_helper.py summary
📊 Task Summary:

  Total Active: 4
  📅 Upcoming (7 days): 1
  🔥 High Priority: 1
```

### ✅ Briefing System
- Morning briefings now show detailed Vikunja tasks
- Task priorities displayed with emojis
- Due times shown in IST
- Projects and labels included

---

## Backward Compatibility

### **Old Scripts Still Work**

If you want to temporarily use the old Obsidian-based system:

1. **CHRONOS**: `/home/ubuntu/vp/.scripts/chronos_tasks.py` (unchanged)
2. **AIAS**: `/home/ubuntu/vp/.scripts/aias_sentinel.py` (unchanged)

To switch back temporarily, update the agent registry:
```typescript
'tasks': {
    script: '.scripts/aias_sentinel.py',  // ← Old version
}
```

### **Hybrid Mode (Optional)**

You can run both systems in parallel:
- Vikunja for structured tasks with priorities/projects
- Obsidian daily notes for quick notes and journal entries

---

## Environment Variables Required

Make sure these are set in `/home/ubuntu/vp/.env`:

```bash
VIKUNJA_API_URL=http://localhost:3456
VIKUNJA_API_TOKEN=tk_68011620e6ea713978bb662940cb21d8ab2dd704
```

For Pantheon (Nuxt), also add to `/home/ubuntu/pantheon-new/.env`:

```bash
VIKUNJA_API_URL=http://localhost:3456
VIKUNJA_API_TOKEN=tk_68011620e6ea713978bb662940cb21d8ab2dd704
```

---

## Troubleshooting

### **1. "401 Unauthorized" error**
**Cause:** Invalid or missing Vikunja API token

**Fix:**
```bash
# Check token
grep VIKUNJA_API_TOKEN /home/ubuntu/vp/.env

# Verify it works
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3456/api/v1/projects
```

### **2. Briefings not showing tasks**
**Cause:** Vikunja integration not loaded

**Fix:**
```bash
# Restart Pantheon
cd /home/ubuntu/pantheon-new
npm run build
pm2 restart pantheon-new
```

### **3. Old task format still showing**
**Cause:** Using old scripts or cached data

**Fix:**
- Verify agent registry points to `*_vikunja.py` scripts
- Clear any cached briefing data
- Restart services

---

## Benefits of Migration

### **For You (VPK)**
1. ✅ **Single Source of Truth** - All tasks in one place
2. ✅ **Natural Language** - Create tasks via Telegram/Discord/CLI
3. ✅ **Smart Organization** - Projects, priorities, labels, recurrence
4. ✅ **Better Visibility** - Rich briefings with task details
5. ✅ **Interactive** - Mark done, view details via buttons
6. ✅ **Cross-Platform** - Access from anywhere (web, mobile, Telegram)

### **For NYX (Your AI)**
1. ✅ **Structured Data** - Easy to query and analyze
2. ✅ **Better Context** - Knows your priorities and projects
3. ✅ **Proactive Alerts** - Can detect conflicts and urgency
4. ✅ **Learning Potential** - Pattern recognition for future enhancements
5. ✅ **Integration Ready** - Can sync with Apollo duty, calendar, etc.

---

## Next Steps

### **Immediate (Done ✅)**
- [x] All agents migrated
- [x] Briefings updated
- [x] Testing completed
- [x] Documentation written

### **Optional Enhancements (Future)**
- [ ] **Bi-directional sync**: Obsidian ↔ Vikunja
- [ ] **Apollo duty conflict detection**: Check Vikunja tasks vs duty schedule
- [ ] **Smart task routing**: Auto-create from emails/messages
- [ ] **Habit tracking**: Recurring tasks with streaks
- [ ] **Voice task creation**: "NYX, remind me to..."

---

## Support

### **If Something Breaks**

1. **Check Vikunja is running:**
   ```bash
   curl http://localhost:3456/api/v1/info
   ```

2. **Test helper script:**
   ```bash
   python3 /home/ubuntu/vp/.scripts/vikunja_helper.py summary
   ```

3. **Check logs:**
   ```bash
   pm2 logs pantheon-new | grep -i vikunja
   ```

4. **Fallback to old system:**
   - Update agent registry to use old scripts
   - Restart Pantheon

---

## Summary

✅ **Migration Complete!**

All NYX sub-agents now use Vikunja as the single source of truth. Your tasks are centralized, organized, and accessible across all platforms. The system is fully tested and production-ready.

**Your workflow remains the same** - just more powerful behind the scenes! 🎉
