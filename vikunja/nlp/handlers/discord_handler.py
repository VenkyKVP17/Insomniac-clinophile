#!/usr/bin/env python3
"""
Discord Handler for Vikunja NLP
Provides Discord integration with slash commands, buttons, and rich embeds
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from zoneinfo import ZoneInfo

from ..engine import VikunjaEngine
from ..api_client import VikunjaClient

IST = ZoneInfo("Asia/Kolkata")


class DiscordTaskHandler:
    """
    Handler for Discord-based task management

    Features:
    - Slash commands (/task, /tasks, /overdue)
    - Rich embeds with colors
    - Button components for actions
    - Task management via Discord
    """

    def __init__(
        self,
        engine: Optional[VikunjaEngine] = None,
        vikunja_client: Optional[VikunjaClient] = None
    ):
        """
        Initialize Discord handler

        Args:
            engine: NLP engine (creates default if None)
            vikunja_client: Vikunja client (creates default if None)
        """
        self.vikunja = vikunja_client or VikunjaClient()
        self.engine = engine or VikunjaEngine(vikunja_client=self.vikunja)

    def handle_slash_command(
        self,
        command_name: str,
        options: Dict[str, Any],
        user_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle Discord slash command

        Args:
            command_name: Command name (e.g., "task", "tasks")
            options: Command options/parameters
            user_context: Optional user context

        Returns:
            Discord response dict with embeds, components, etc.
        """
        if command_name == "task":
            return self.handle_task_create(
                options.get("description", ""),
                user_context
            )

        elif command_name == "tasks":
            return self.handle_tasks_list(
                include_done=options.get("include_done", False),
                limit=options.get("limit", 10)
            )

        elif command_name == "overdue":
            return self.handle_overdue_tasks()

        elif command_name == "search":
            return self.handle_task_search(options.get("query", ""))

        elif command_name == "done":
            return self.handle_mark_done(options.get("task_id"))

        else:
            return {
                "content": "❌ Unknown command",
                "ephemeral": True
            }

    def handle_task_create(self, task_text: str, user_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Handle /task slash command

        Args:
            task_text: Task description
            user_context: Optional context

        Returns:
            Discord response
        """
        if not task_text.strip():
            return {
                "content": "📝 **Create Task**\n\n"
                          "Usage: `/task description:<text>`\n\n"
                          "Examples:\n"
                          "• `/task description:Buy groceries tomorrow at 5pm #errands`\n"
                          "• `/task description:Submit MBA assignment by Friday urgent @study`\n"
                          "• `/task description:Daily standup meeting at 10am every weekday`",
                "ephemeral": True
            }

        try:
            # Parse and create task
            result = self.engine.create_task(task_text, context=user_context)

            # Build rich embed
            embed = self.build_task_embed(result, title="✅ Task Created")

            # Build action buttons
            components = self.build_task_components(result["id"])

            return {
                "embeds": [embed],
                "components": components
            }

        except Exception as e:
            return {
                "content": f"❌ **Error Creating Task**\n\n{str(e)}",
                "ephemeral": True
            }

    def handle_tasks_list(self, include_done: bool = False, limit: int = 10) -> Dict[str, Any]:
        """
        Handle /tasks slash command

        Args:
            include_done: Include completed tasks
            limit: Maximum tasks to show

        Returns:
            Discord response
        """
        try:
            tasks = self.vikunja.list_tasks(include_done=include_done)

            # Sort by due date
            def sort_key(task):
                due = task.get("due_date", "9999-99-99")
                return due if not due.startswith("0001") else "9999-99-99"

            tasks = sorted(tasks, key=sort_key)[:limit]

            if not tasks:
                return {
                    "content": "✅ No open tasks! You're all caught up.",
                    "ephemeral": True
                }

            # Build embed with task list
            embed = {
                "title": "📋 Your Tasks",
                "color": 0x3498db,  # Blue
                "fields": []
            }

            for task in tasks:
                field = self.build_task_field(task)
                embed["fields"].append(field)

            # Add quick action select menu
            components = self.build_task_list_components([t["id"] for t in tasks])

            return {
                "embeds": [embed],
                "components": components
            }

        except Exception as e:
            return {
                "content": f"❌ **Error Listing Tasks**\n\n{str(e)}",
                "ephemeral": True
            }

    def handle_overdue_tasks(self) -> Dict[str, Any]:
        """Handle /overdue command"""
        try:
            tasks = self.vikunja.get_overdue_tasks()

            if not tasks:
                return {
                    "content": "✅ No overdue tasks! Well done.",
                    "ephemeral": True
                }

            # Build embed
            embed = {
                "title": "⚠️ Overdue Tasks",
                "color": 0xe74c3c,  # Red
                "fields": []
            }

            for task in tasks[:10]:
                field = self.build_task_field(task, show_overdue=True)
                embed["fields"].append(field)

            # Add quick action buttons
            components = self.build_task_list_components([t["id"] for t in tasks[:10]])

            return {
                "embeds": [embed],
                "components": components
            }

        except Exception as e:
            return {
                "content": f"❌ **Error**\n\n{str(e)}",
                "ephemeral": True
            }

    def handle_task_search(self, query: str) -> Dict[str, Any]:
        """Handle /search command"""
        try:
            if not query.strip():
                return {
                    "content": "Please provide a search query.",
                    "ephemeral": True
                }

            tasks = self.vikunja.search_tasks(query)

            if not tasks:
                return {
                    "content": f"No tasks found matching '{query}'.",
                    "ephemeral": True
                }

            # Build embed
            embed = {
                "title": f"🔍 Search Results: '{query}'",
                "color": 0x9b59b6,  # Purple
                "fields": []
            }

            for task in tasks[:10]:
                field = self.build_task_field(task)
                embed["fields"].append(field)

            return {
                "embeds": [embed]
            }

        except Exception as e:
            return {
                "content": f"❌ Error: {str(e)}",
                "ephemeral": True
            }

    def handle_mark_done(self, task_id: Optional[int]) -> Dict[str, Any]:
        """Handle /done command"""
        try:
            if not task_id:
                return {
                    "content": "Please provide a task ID.",
                    "ephemeral": True
                }

            self.vikunja.mark_done(task_id)

            return {
                "content": f"✅ Task #{task_id} marked as complete!",
                "ephemeral": True
            }

        except Exception as e:
            return {
                "content": f"❌ Error: {str(e)}",
                "ephemeral": True
            }

    def handle_button_click(self, custom_id: str) -> Dict[str, Any]:
        """
        Handle button component interaction

        Args:
            custom_id: Button custom ID (e.g., "task_done:123")

        Returns:
            Discord response
        """
        try:
            action, task_id_str = custom_id.split(":", 1)
            task_id = int(task_id_str)

            if action == "task_done":
                self.vikunja.mark_done(task_id)
                return {
                    "content": f"✅ Task #{task_id} marked as complete!",
                    "ephemeral": True
                }

            elif action == "task_delete":
                self.vikunja.delete_task(task_id)
                return {
                    "content": f"🗑️ Task #{task_id} deleted.",
                    "ephemeral": True
                }

            elif action == "task_view":
                task = self.vikunja.get_task(task_id)
                embed = self.build_task_embed(task, title=f"📝 Task #{task_id}")
                return {
                    "embeds": [embed],
                    "ephemeral": True
                }

        except Exception as e:
            return {
                "content": f"❌ Error: {str(e)}",
                "ephemeral": True
            }

    # ===== EMBED & COMPONENT BUILDERS =====

    def build_task_embed(self, task: Dict, title: Optional[str] = None) -> Dict:
        """Build rich embed for task"""
        # Determine color based on priority
        priority = task.get("priority", 0)
        colors = [0x95a5a6, 0x2ecc71, 0x3498db, 0xf39c12, 0xe67e22, 0xe74c3c]
        color = colors[priority]

        embed = {
            "title": title or task.get("title", "Task"),
            "color": color,
            "fields": []
        }

        # Title field (if custom title was provided)
        if title:
            embed["fields"].append({
                "name": "Title",
                "value": task.get("title", "Untitled"),
                "inline": False
            })

        # Description
        description = task.get("description", "")
        if description:
            embed["fields"].append({
                "name": "Description",
                "value": description[:1024],  # Discord field limit
                "inline": False
            })

        # Due date
        due_date = task.get("due_date", "")
        if due_date and not due_date.startswith("0001"):
            embed["fields"].append({
                "name": "📅 Due",
                "value": self.format_date(due_date),
                "inline": True
            })

        # Priority
        if priority > 0:
            priority_names = ["None", "Low", "Medium", "High", "Urgent", "Critical"]
            emojis = ["", "🟢", "⚪", "🟡", "🟠", "🔴"]
            embed["fields"].append({
                "name": "Priority",
                "value": f"{emojis[priority]} {priority_names[priority]}",
                "inline": True
            })

        # Project
        project = task.get("_project_name", "")
        if project:
            embed["fields"].append({
                "name": "📁 Project",
                "value": project,
                "inline": True
            })

        # Labels
        labels = task.get("labels", [])
        if labels:
            label_names = [l.get("title", "") for l in labels if isinstance(l, dict)]
            if label_names:
                embed["fields"].append({
                    "name": "🏷️ Labels",
                    "value": ", ".join(label_names),
                    "inline": False
                })

        # Recurrence
        repeat_after = task.get("repeat_after", 0)
        if repeat_after > 0:
            from ..parsers.recurrence_parser import RecurrenceParser
            repeat_str = RecurrenceParser.format_recurrence(repeat_after, task.get("repeat_mode", 0))
            embed["fields"].append({
                "name": "🔁 Repeats",
                "value": repeat_str,
                "inline": True
            })

        # Task ID
        embed["footer"] = {
            "text": f"Task ID: {task['id']}"
        }

        return embed

    def build_task_field(self, task: Dict, show_overdue: bool = False) -> Dict:
        """Build single field for task list"""
        task_id = task["id"]
        title = task.get("title", "Untitled")
        done = task.get("done", False)

        # Build value string
        value_parts = []

        # Status
        status = "✅ Complete" if done else "⏳ Pending"
        value_parts.append(f"**Status:** {status}")

        # Priority
        priority = task.get("priority", 0)
        if priority > 0:
            emojis = ["", "🟢", "⚪", "🟡", "🟠", "🔴"]
            value_parts.append(f"**Priority:** {emojis[priority]}")

        # Due date
        due_date = task.get("due_date", "")
        if due_date and not due_date.startswith("0001"):
            due_formatted = self.format_date(due_date, short=True)
            if show_overdue:
                value_parts.append(f"**Due:** ⚠️ {due_formatted}")
            else:
                value_parts.append(f"**Due:** {due_formatted}")

        # Project
        project = task.get("_project_name", "")
        if project:
            value_parts.append(f"**Project:** {project}")

        return {
            "name": f"#{task_id} - {title}",
            "value": "\n".join(value_parts),
            "inline": False
        }

    @staticmethod
    def build_task_components(task_id: int) -> List[Dict]:
        """Build action button components"""
        return [
            {
                "type": 1,  # Action Row
                "components": [
                    {
                        "type": 2,  # Button
                        "style": 3,  # Success (green)
                        "label": "Mark Done",
                        "custom_id": f"task_done:{task_id}"
                    },
                    {
                        "type": 2,
                        "style": 1,  # Primary (blue)
                        "label": "View Details",
                        "custom_id": f"task_view:{task_id}"
                    },
                    {
                        "type": 2,
                        "style": 4,  # Danger (red)
                        "label": "Delete",
                        "custom_id": f"task_delete:{task_id}"
                    }
                ]
            }
        ]

    @staticmethod
    def build_task_list_components(task_ids: List[int]) -> List[Dict]:
        """Build select menu for task actions"""
        options = []
        for task_id in task_ids[:25]:  # Discord limit
            options.append({
                "label": f"Task #{task_id}",
                "value": str(task_id),
                "description": "Mark as done"
            })

        return [
            {
                "type": 1,  # Action Row
                "components": [
                    {
                        "type": 3,  # Select Menu
                        "custom_id": "task_select_done",
                        "placeholder": "Select a task to mark as done",
                        "options": options
                    }
                ]
            }
        ]

    @staticmethod
    def format_date(date_str: str, short: bool = False) -> str:
        """Format ISO date to human-readable IST"""
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            dt_ist = dt.astimezone(IST)

            if short:
                return dt_ist.strftime("%d %b, %H:%M")
            else:
                return dt_ist.strftime("%d %b %Y, %H:%M IST")
        except Exception:
            return date_str


    # ===== SLASH COMMAND DEFINITIONS =====

    @staticmethod
    def get_slash_commands() -> List[Dict]:
        """
        Get Discord slash command definitions for registration

        Returns:
            List of command definitions
        """
        return [
            {
                "name": "task",
                "description": "Create a new task using natural language",
                "options": [
                    {
                        "name": "description",
                        "description": "Task description (e.g., 'Buy groceries tomorrow at 5pm #errands')",
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
            },
            {
                "name": "done",
                "description": "Mark a task as complete",
                "options": [
                    {
                        "name": "task_id",
                        "description": "Task ID",
                        "type": 4,  # INTEGER
                        "required": True
                    }
                ]
            }
        ]
