#!/usr/bin/env python3
"""
Telegram Handler for Vikunja NLP
Provides rich Telegram integration with buttons, inline mode, and quick actions
"""

import re
from typing import Dict, List, Optional, Any
from datetime import datetime
from zoneinfo import ZoneInfo

from ..engine import VikunjaEngine
from ..api_client import VikunjaClient

IST = ZoneInfo("Asia/Kolkata")


class TelegramTaskHandler:
    """
    Handler for Telegram-based task management

    Features:
    - /task command for quick task creation
    - Inline task creation from any message
    - Interactive buttons for task actions
    - Task listing and completion
    - Rich formatting
    """

    def __init__(
        self,
        engine: Optional[VikunjaEngine] = None,
        vikunja_client: Optional[VikunjaClient] = None
    ):
        """
        Initialize Telegram handler

        Args:
            engine: NLP engine (creates default if None)
            vikunja_client: Vikunja client (creates default if None)
        """
        self.vikunja = vikunja_client or VikunjaClient()
        self.engine = engine or VikunjaEngine(vikunja_client=self.vikunja)

    def handle_message(self, message_text: str, user_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Handle incoming Telegram message

        Args:
            message_text: Message text
            user_context: Optional user context

        Returns:
            Response dict with text, buttons, etc.
        """
        # Check for commands
        if message_text.startswith("/task"):
            return self.handle_task_command(message_text[5:].strip(), user_context)

        elif message_text.startswith("/tasks"):
            return self.handle_tasks_list()

        elif message_text.startswith("/overdue"):
            return self.handle_overdue_tasks()

        # Check for inline task creation (starts with "task:" or similar)
        if re.match(r"^(task|todo|reminder):\s*", message_text, re.I):
            task_text = re.sub(r"^(task|todo|reminder):\s*", "", message_text, flags=re.I)
            return self.handle_task_command(task_text, user_context)

        # Default: not a task command
        return {"handled": False}

    def handle_task_command(self, task_text: str, user_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Handle /task command or inline task creation

        Args:
            task_text: Task description
            user_context: Optional context

        Returns:
            Response dict
        """
        if not task_text.strip():
            return {
                "text": "📝 *Create Task*\n\nUsage: `/task <description>`\n\nExamples:\n"
                        "• `/task Buy groceries tomorrow at 5pm #errands`\n"
                        "• `/task Submit MBA assignment by Friday urgent @study`\n"
                        "• `/task Daily standup meeting at 10am every weekday`",
                "parse_mode": "Markdown"
            }

        try:
            # Parse and create task
            result = self.engine.create_task(task_text, context=user_context)

            # Format success response
            response_text = self.format_task_created(result)

            # Add action buttons
            buttons = self.build_task_buttons(result["id"])

            return {
                "text": response_text,
                "parse_mode": "Markdown",
                "buttons": buttons
            }

        except Exception as e:
            return {
                "text": f"❌ *Error Creating Task*\n\n{str(e)}",
                "parse_mode": "Markdown"
            }

    def handle_tasks_list(self, include_done: bool = False, limit: int = 10) -> Dict[str, Any]:
        """
        Handle /tasks command - list recent tasks

        Args:
            include_done: Include completed tasks
            limit: Maximum tasks to show

        Returns:
            Response dict
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
                    "text": "✅ No open tasks! You're all caught up, Sir.",
                    "parse_mode": "Markdown"
                }

            response_text = "📋 *Your Tasks*\n\n"
            buttons = []

            for task in tasks:
                # Format task item
                task_line = self.format_task_item(task)
                response_text += task_line + "\n"

                # Add mark done button
                buttons.append({
                    "text": f"✅ {task['id']}",
                    "callback_data": f"task_done:{task['id']}"
                })

            return {
                "text": response_text,
                "parse_mode": "Markdown",
                "buttons": buttons
            }

        except Exception as e:
            return {
                "text": f"❌ *Error Listing Tasks*\n\n{str(e)}",
                "parse_mode": "Markdown"
            }

    def handle_overdue_tasks(self) -> Dict[str, Any]:
        """Handle /overdue command - show overdue tasks"""
        try:
            tasks = self.vikunja.get_overdue_tasks()

            if not tasks:
                return {
                    "text": "✅ No overdue tasks! Well done.",
                    "parse_mode": "Markdown"
                }

            response_text = "⚠️ *Overdue Tasks*\n\n"
            buttons = []

            for task in tasks[:10]:
                task_line = self.format_task_item(task, show_overdue=True)
                response_text += task_line + "\n"

                buttons.append({
                    "text": f"✅ {task['id']}",
                    "callback_data": f"task_done:{task['id']}"
                })

            return {
                "text": response_text,
                "parse_mode": "Markdown",
                "buttons": buttons
            }

        except Exception as e:
            return {
                "text": f"❌ *Error*\n\n{str(e)}",
                "parse_mode": "Markdown"
            }

    def handle_callback(self, callback_data: str) -> Dict[str, Any]:
        """
        Handle button callback

        Args:
            callback_data: Callback data (e.g., "task_done:123")

        Returns:
            Response dict
        """
        try:
            action, task_id_str = callback_data.split(":", 1)
            task_id = int(task_id_str)

            if action == "task_done":
                self.vikunja.mark_done(task_id)
                return {
                    "text": f"✅ Task {task_id} marked as complete!",
                    "alert": True
                }

            elif action == "task_delete":
                self.vikunja.delete_task(task_id)
                return {
                    "text": f"🗑️ Task {task_id} deleted.",
                    "alert": True
                }

            elif action == "task_view":
                task = self.vikunja.get_task(task_id)
                return {
                    "text": self.format_task_detail(task),
                    "parse_mode": "Markdown"
                }

        except Exception as e:
            return {
                "text": f"❌ Error: {str(e)}",
                "alert": True
            }

    # ===== FORMATTING HELPERS =====

    def format_task_created(self, task: Dict) -> str:
        """Format task creation success message"""
        text = "✅ *Task Created*\n\n"
        text += f"*Title:* {task.get('title', 'Untitled')}\n"

        due_date = task.get("due_date", "")
        if due_date and not due_date.startswith("0001"):
            due_formatted = self.format_date(due_date)
            text += f"*Due:* {due_formatted}\n"

        priority = task.get("priority", 0)
        if priority > 0:
            priority_name = ["None", "Low", "Medium", "High", "Urgent", "Critical"][priority]
            emoji = ["", "🟢", "⚪", "🟡", "🟠", "🔴"][priority]
            text += f"*Priority:* {emoji} {priority_name}\n"

        project_name = task.get("_project_name", "")
        if project_name:
            text += f"*Project:* {project_name}\n"

        labels = task.get("labels", [])
        if labels:
            label_names = [l.get("title", "") for l in labels if isinstance(l, dict)]
            if label_names:
                text += f"*Labels:* {', '.join(label_names)}\n"

        repeat_after = task.get("repeat_after", 0)
        if repeat_after > 0:
            from ..parsers.recurrence_parser import RecurrenceParser
            repeat_str = RecurrenceParser.format_recurrence(repeat_after, task.get("repeat_mode", 0))
            text += f"*Repeats:* {repeat_str}\n"

        text += f"\n*ID:* `{task['id']}`"

        return text

    def format_task_item(self, task: Dict, show_overdue: bool = False) -> str:
        """Format single task for list view"""
        task_id = task["id"]
        title = task.get("title", "Untitled")
        done = task.get("done", False)

        # Status checkbox
        checkbox = "✅" if done else "☑️"

        # Priority emoji
        priority = task.get("priority", 0)
        priority_emoji = ["", "🟢", "⚪", "🟡", "🟠", "🔴"][priority]

        # Due date
        due_date = task.get("due_date", "")
        due_str = ""
        if due_date and not due_date.startswith("0001"):
            due_formatted = self.format_date(due_date, short=True)
            if show_overdue:
                due_str = f" ⚠️ {due_formatted}"
            else:
                due_str = f" 📅 {due_formatted}"

        # Project
        project = task.get("_project_name", "")
        project_str = f" @{project}" if project else ""

        return f"{checkbox} `{task_id}` {priority_emoji} *{title}*{due_str}{project_str}"

    def format_task_detail(self, task: Dict) -> str:
        """Format detailed task view"""
        text = f"📝 *Task #{task['id']}*\n\n"
        text += f"*Title:* {task.get('title', 'Untitled')}\n"

        description = task.get("description", "")
        if description:
            text += f"*Description:* {description}\n"

        due_date = task.get("due_date", "")
        if due_date and not due_date.startswith("0001"):
            text += f"*Due:* {self.format_date(due_date)}\n"

        start_date = task.get("start_date", "")
        if start_date and not start_date.startswith("0001"):
            text += f"*Start:* {self.format_date(start_date)}\n"

        priority = task.get("priority", 0)
        if priority > 0:
            priority_name = ["None", "Low", "Medium", "High", "Urgent", "Critical"][priority]
            emoji = ["", "🟢", "⚪", "🟡", "🟠", "🔴"][priority]
            text += f"*Priority:* {emoji} {priority_name}\n"

        project = task.get("_project_name", "")
        if project:
            text += f"*Project:* {project}\n"

        labels = task.get("labels", [])
        if labels:
            label_names = [l.get("title", "") for l in labels if isinstance(l, dict)]
            if label_names:
                text += f"*Labels:* {', '.join(label_names)}\n"

        done = task.get("done", False)
        text += f"*Status:* {'✅ Complete' if done else '⏳ Pending'}\n"

        return text

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

    @staticmethod
    def build_task_buttons(task_id: int) -> List[List[Dict]]:
        """Build inline keyboard buttons for task"""
        return [
            [
                {"text": "✅ Mark Done", "callback_data": f"task_done:{task_id}"},
                {"text": "👁️ View", "callback_data": f"task_view:{task_id}"}
            ],
            [
                {"text": "🗑️ Delete", "callback_data": f"task_delete:{task_id}"}
            ]
        ]
