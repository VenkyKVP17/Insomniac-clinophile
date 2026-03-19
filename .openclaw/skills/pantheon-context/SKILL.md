---
name: pantheon-context
description: Bridge for querying the Pantheon Intelligence Layer (Vault, DB, Tasks)
---

# 🏛️ Pantheon Context Skill

This skill allows the OpenClaw agent to access real-time context from VPK's core systems (Obsidian Vault, SQLite Databases, Task Roster).

## 🛠️ Tools

### `query_pantheon`
Query the Pantheon server for specific information or context.

**Parameters:**
- `type`: Either `vault_search` or `system_status`
- `query`: The search term or question

**Logic:**
Calls `http://localhost:3000/api/intelligence/context` via `curl`.

---

## 🦾 Implementation
```bash
# Example internal usage for OpenClaw
curl -X POST http://localhost:3000/api/intelligence/context \
     -H "Content-Type: application/json" \
     -d "{\"type\": \"$type\", \"query\": \"$query\"}"
```
