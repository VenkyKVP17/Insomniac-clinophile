"""
LLM Prompts for Vikunja NLP
"""

def build_task_parsing_prompt(text: str, current_time: str, projects: str, context: str = "") -> str:
    """
    Build prompt for LLM task parsing

    Args:
        text: User's natural language input
        current_time: Current timestamp in IST
        projects: Comma-separated list of available projects
        context: Additional context about the user

    Returns:
        Complete prompt for LLM
    """
    prompt = f"""You are an expert task parser for VPK's personal task management system (Vikunja).

**CURRENT TIME**: {current_time}

**AVAILABLE PROJECTS**: {projects}

**USER'S REQUEST**: "{text}"
"""

    if context:
        prompt += f"""
**USER CONTEXT**:
{context}
"""

    prompt += """
**YOUR TASK**:
Parse the user's request into a structured task. Extract ALL relevant information.

**OUTPUT FORMAT** (JSON only, no explanations):
```json
{
  "title": "Clear, actionable task title (cleaned of metadata)",
  "description": "Optional detailed description",
  "due_date": "YYYY-MM-DDTHH:MM:SSZ" or null,
  "start_date": "YYYY-MM-DDTHH:MM:SSZ" or null,
  "priority": 0-5 (0=none, 1=low, 2=medium, 3=high, 4=urgent, 5=critical),
  "project_id": "project_name" or null,
  "labels": ["label1", "label2"],
  "repeat_after": seconds (0 if not recurring),
  "repeat_mode": 0-2 (0=seconds, 1=month, 2=year)
}
```

**RULES**:
1. **Title**: Must be clean, concise, actionable. Remove time expressions, priorities, labels.
2. **Dates**: Parse ALL temporal expressions. Use ISO 8601 UTC format. Consider IST timezone.
3. **Priority**: Infer from urgency words (critical, urgent, asap, important, etc) and emojis (🔴, 🟠, 🟡).
4. **Project**: Match to available projects using keywords. Use exact project name or null.
5. **Labels**: Extract #hashtags and contextual tags.
6. **Recurrence**: Parse patterns like "daily", "every week", "every 2 days", etc.
7. **Smart defaults**: If time not specified for a date, use 09:00 IST.

**EXAMPLES**:

Input: "Buy groceries tomorrow at 5pm #errands"
Output:
```json
{
  "title": "Buy groceries",
  "description": "",
  "due_date": "2026-03-22T11:30:00Z",
  "start_date": null,
  "priority": 0,
  "project_id": "errands",
  "labels": ["errands"],
  "repeat_after": 0,
  "repeat_mode": 0
}
```

Input: "🔴 Submit MBA assignment by Friday EOD @study"
Output:
```json
{
  "title": "Submit MBA assignment",
  "description": "",
  "due_date": "2026-03-28T18:29:00Z",
  "start_date": null,
  "priority": 5,
  "project_id": "study",
  "labels": [],
  "repeat_after": 0,
  "repeat_mode": 0
}
```

Input: "Daily standup meeting every weekday at 10am starting Monday"
Output:
```json
{
  "title": "Daily standup meeting",
  "description": "",
  "due_date": "2026-03-24T04:30:00Z",
  "start_date": null,
  "priority": 0,
  "project_id": null,
  "labels": [],
  "repeat_after": 86400,
  "repeat_mode": 0
}
```

Now parse the user's request and output ONLY the JSON.
"""

    return prompt


TASK_PARSING_PROMPT = build_task_parsing_prompt
