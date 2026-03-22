#!/usr/bin/env python3
"""
Vikunja NLP CLI Tool
Command-line interface for testing and using the NLP engine
"""

import sys
import argparse
from pathlib import Path

from .engine import VikunjaEngine
from .api_client import VikunjaClient
from .handlers import TelegramTaskHandler, DiscordTaskHandler


def print_task(task: dict, project_name: str = ""):
    """Pretty print a parsed or created task"""
    print("\n" + "="*60)
    print("📝 TASK DETAILS")
    print("="*60)

    print(f"\n{'Title':<15}: {task.get('title', 'Untitled')}")

    description = task.get("description", "")
    if description:
        print(f"{'Description':<15}: {description}")

    due_date = task.get("due_date", "")
    if due_date and not due_date.startswith("0001"):
        print(f"{'Due Date':<15}: {format_date(due_date)}")

    start_date = task.get("start_date", "")
    if start_date and not start_date.startswith("0001"):
        print(f"{'Start Date':<15}: {format_date(start_date)}")

    priority = task.get("priority", 0)
    if priority > 0:
        priority_names = ["None", "Low", "Medium", "High", "Urgent", "Critical"]
        emojis = ["", "🟢", "⚪", "🟡", "🟠", "🔴"]
        print(f"{'Priority':<15}: {emojis[priority]} {priority_names[priority]}")

    if project_name:
        print(f"{'Project':<15}: {project_name}")

    labels = task.get("labels", [])
    if labels:
        label_names = [l.get("title", "") if isinstance(l, dict) else l for l in labels]
        print(f"{'Labels':<15}: {', '.join(label_names)}")

    repeat_after = task.get("repeat_after", 0)
    if repeat_after > 0:
        from .parsers.recurrence_parser import RecurrenceParser
        repeat_str = RecurrenceParser.format_recurrence(repeat_after, task.get("repeat_mode", 0))
        print(f"{'Recurrence':<15}: {repeat_str}")

    reminders = task.get("reminders", [])
    for reminder in reminders:
        reminder_time = reminder.get("reminder", "")
        if reminder_time and not reminder_time.startswith("0001"):
            print(f"{'Reminder':<15}: {format_date(reminder_time)}")

    if "id" in task:
        print(f"\n{'Task ID':<15}: {task['id']}")

    print("="*60 + "\n")


def format_date(date_str: str) -> str:
    """Format ISO date to human-readable"""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        dt_ist = dt.astimezone(ZoneInfo("Asia/Kolkata"))
        return dt_ist.strftime("%d %b %Y, %H:%M IST")
    except Exception:
        return date_str


def main():
    parser = argparse.ArgumentParser(
        description="Vikunja NLP - Natural Language Task Management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Parse and create a task
  %(prog)s "Buy groceries tomorrow at 5pm #errands"

  # Parse only (dry run)
  %(prog)s --dry-run "Submit report by Friday urgent @work"

  # Disable LLM fallback
  %(prog)s --no-llm "Daily standup every weekday at 10am"

  # List tasks
  %(prog)s --list

  # List tasks in a specific project
  %(prog)s --list --project "Study"

  # Search tasks
  %(prog)s --search "groceries"

  # Mark task as done
  %(prog)s --done 123

  # Show overdue tasks
  %(prog)s --overdue

  # Read from stdin
  echo "Meeting with client tomorrow at 3pm" | %(prog)s --stdin
        """
    )

    parser.add_argument(
        "task",
        nargs="?",
        help="Natural language task description"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse only, don't create task"
    )

    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Disable LLM fallback (regex only)"
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="List all tasks"
    )

    parser.add_argument(
        "--project",
        type=str,
        help="Filter by project name"
    )

    parser.add_argument(
        "--search",
        type=str,
        metavar="QUERY",
        help="Search tasks"
    )

    parser.add_argument(
        "--done",
        type=int,
        metavar="ID",
        help="Mark task as done"
    )

    parser.add_argument(
        "--delete",
        type=int,
        metavar="ID",
        help="Delete task"
    )

    parser.add_argument(
        "--overdue",
        action="store_true",
        help="Show overdue tasks"
    )

    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read tasks from stdin (one per line)"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON"
    )

    parser.add_argument(
        "--projects",
        action="store_true",
        help="List all projects"
    )

    args = parser.parse_args()

    # Initialize clients
    try:
        vikunja = VikunjaClient()
        engine = VikunjaEngine(vikunja_client=vikunja, use_llm=not args.no_llm)
    except Exception as e:
        print(f"❌ Error initializing: {e}", file=sys.stderr)
        sys.exit(1)

    # Handle list projects
    if args.projects:
        projects = vikunja.get_projects()
        print("\n📁 PROJECTS\n" + "="*60)
        for p in projects:
            print(f"  [{p['id']}] {p['title']}")
        print("="*60 + "\n")
        return

    # Handle list tasks
    if args.list:
        project_id = None
        if args.project:
            project_map = vikunja.get_project_map()
            project_id = project_map.get(args.project.lower())

        tasks = vikunja.list_tasks(project_id=project_id)

        if not tasks:
            print("✅ No tasks found.")
            return

        print(f"\n📋 TASKS ({len(tasks)} total)\n" + "="*60)
        for task in tasks:
            checkbox = "✅" if task.get("done") else "☑️"
            title = task.get("title", "Untitled")
            task_id = task["id"]
            priority = task.get("priority", 0)
            emojis = ["", "🟢", "⚪", "🟡", "🟠", "🔴"]
            print(f"{checkbox} [{task_id:3}] {emojis[priority]} {title}")
        print("="*60 + "\n")
        return

    # Handle search
    if args.search:
        tasks = vikunja.search_tasks(args.search)

        if not tasks:
            print(f"No tasks found matching '{args.search}'.")
            return

        print(f"\n🔍 SEARCH RESULTS: '{args.search}'\n" + "="*60)
        for task in tasks:
            checkbox = "✅" if task.get("done") else "☑️"
            title = task.get("title", "Untitled")
            task_id = task["id"]
            print(f"{checkbox} [{task_id:3}] {title}")
        print("="*60 + "\n")
        return

    # Handle mark done
    if args.done:
        try:
            vikunja.mark_done(args.done)
            print(f"✅ Task {args.done} marked as complete!")
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            sys.exit(1)
        return

    # Handle delete
    if args.delete:
        try:
            vikunja.delete_task(args.delete)
            print(f"🗑️ Task {args.delete} deleted.")
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            sys.exit(1)
        return

    # Handle overdue
    if args.overdue:
        tasks = vikunja.get_overdue_tasks()

        if not tasks:
            print("✅ No overdue tasks! Well done.")
            return

        print(f"\n⚠️ OVERDUE TASKS ({len(tasks)} total)\n" + "="*60)
        for task in tasks:
            title = task.get("title", "Untitled")
            task_id = task["id"]
            due_date = format_date(task.get("due_date", ""))
            print(f"☑️ [{task_id:3}] {title}\n    Due: {due_date}")
        print("="*60 + "\n")
        return

    # Handle task creation
    def process_task(text: str):
        if not text.strip():
            return

        try:
            if args.dry_run:
                result = engine.parse(text)
                if args.json:
                    import json
                    print(json.dumps(result, indent=2, default=str))
                    return
                
                project_map = vikunja.get_project_map()
                project_name = next(
                    (name for name, pid in project_map.items() if pid == result["project_id"]),
                    "inbox"
                )
                print(f"\n📝 Parsing: {text!r}")
                print_task(result, project_name)
            else:
                if not args.json:
                    print(f"\n📝 Creating task: {text!r}")
                
                result = engine.create_task(text)
                
                if args.json:
                    import json
                    print(json.dumps(result, indent=2, default=str))
                    return

                project_name = result.get("_project_name", "")
                print_task(result, project_name)
                print(f"✅ Task created successfully!")

        except Exception as e:
            if args.json:
                import json
                print(json.dumps({"error": str(e)}))
            else:
                print(f"❌ Error: {e}", file=sys.stderr)
            sys.exit(1)

    # Read from stdin
    if args.stdin:
        for line in sys.stdin:
            process_task(line.strip())

    # Read from command line argument
    elif args.task:
        process_task(args.task)

    # No command provided
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
