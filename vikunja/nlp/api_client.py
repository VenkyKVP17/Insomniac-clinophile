#!/usr/bin/env python3
"""
Vikunja API Client
Comprehensive wrapper for Vikunja REST API
"""

import os
import requests
from typing import Optional, Dict, List, Any
from pathlib import Path

class VikunjaClient:
    """Client for interacting with Vikunja API"""

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_token: Optional[str] = None,
        timeout: int = 30
    ):
        """
        Initialize Vikunja client

        Args:
            api_url: Vikunja API URL (defaults to env VIKUNJA_API_URL)
            api_token: API token (defaults to env VIKUNJA_API_TOKEN)
            timeout: Request timeout in seconds
        """
        self.api_url = (api_url or os.getenv("VIKUNJA_API_URL", "http://localhost:3456")).rstrip("/")
        self.api_token = api_token or os.getenv("VIKUNJA_API_TOKEN", "")
        self.timeout = timeout
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        """
        Make API request

        Args:
            method: HTTP method
            endpoint: API endpoint (without /api/v1 prefix)
            **kwargs: Additional request parameters

        Returns:
            Response JSON

        Raises:
            requests.HTTPError: On API error
        """
        url = f"{self.api_url}/api/v1{endpoint}"
        kwargs.setdefault("headers", self.headers)
        kwargs.setdefault("timeout", self.timeout)

        response = requests.request(method, url, **kwargs)
        response.raise_for_status()

        # Handle empty responses
        if not response.text.strip():
            return {}

        return response.json()

    # ===== PROJECT OPERATIONS =====

    def get_projects(self) -> List[Dict]:
        """Get all projects"""
        return self._request("GET", "/projects")

    def get_project(self, project_id: int) -> Dict:
        """Get project by ID"""
        return self._request("GET", f"/projects/{project_id}")

    def create_project(self, title: str, **kwargs) -> Dict:
        """Create new project"""
        payload = {"title": title, **kwargs}
        return self._request("POST", "/projects", json=payload)

    def get_project_map(self) -> Dict[str, int]:
        """Get mapping of project names (lowercase) to IDs"""
        projects = self.get_projects()
        return {p["title"].lower(): p["id"] for p in projects}

    # ===== LABEL OPERATIONS =====

    def get_labels(self) -> List[Dict]:
        """Get all labels"""
        return self._request("GET", "/labels")

    def get_or_create_label(self, title: str, hex_color: str = "") -> int:
        """
        Get existing label ID or create new one

        Args:
            title: Label title
            hex_color: Hex color code (optional)

        Returns:
            Label ID
        """
        # Check if label exists
        labels = self.get_labels()
        for label in labels:
            if label["title"].lower() == title.lower():
                return label["id"]

        # Create new label
        payload = {"title": title, "hex_color": hex_color}
        result = self._request("POST", "/labels", json=payload)
        return result["id"]

    # ===== TASK OPERATIONS =====

    def create_task(self, project_id: int, payload: Dict) -> Dict:
        """
        Create task in project

        Args:
            project_id: Project ID
            payload: Task data

        Returns:
            Created task
        """
        return self._request("PUT", f"/projects/{project_id}/tasks", json=payload)

    def get_task(self, task_id: int) -> Dict:
        """Get task by ID"""
        return self._request("GET", f"/tasks/{task_id}")

    def update_task(self, task_id: int, payload: Dict) -> Dict:
        """Update task"""
        return self._request("POST", f"/tasks/{task_id}", json=payload)

    def delete_task(self, task_id: int) -> Dict:
        """Delete task"""
        return self._request("DELETE", f"/tasks/{task_id}")

    def mark_done(self, task_id: int) -> Dict:
        """Mark task as done"""
        return self.update_task(task_id, {"done": True})

    def list_tasks(
        self,
        project_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 100,
        include_done: bool = False
    ) -> List[Dict]:
        """
        List tasks

        Args:
            project_id: Filter by project (None for all projects)
            page: Page number
            per_page: Items per page
            include_done: Include completed tasks

        Returns:
            List of tasks
        """
        params = {"page": page, "per_page": per_page}

        if project_id:
            tasks = self._request("GET", f"/projects/{project_id}/tasks", params=params) or []
        else:
            # Get tasks from all projects
            tasks = []
            projects = self.get_projects()
            for project in projects:
                try:
                    project_tasks = self._request(
                        "GET",
                        f"/projects/{project['id']}/tasks",
                        params=params
                    ) or []

                    # Add project name to each task
                    for task in project_tasks:
                        task["_project_name"] = project["title"]

                    tasks.extend(project_tasks)
                except Exception:
                    # Skip projects we can't access
                    continue

        # Filter out done tasks if requested
        if not include_done:
            tasks = [t for t in tasks if not t.get("done", False)]

        return tasks

    def search_tasks(self, query: str) -> List[Dict]:
        """
        Search tasks by text in title or description

        Args:
            query: Search query

        Returns:
            Matching tasks
        """
        all_tasks = self.list_tasks()
        query_lower = query.lower()

        return [
            task for task in all_tasks
            if query_lower in task.get("title", "").lower()
            or query_lower in task.get("description", "").lower()
        ]

    def get_overdue_tasks(self) -> List[Dict]:
        """Get all overdue tasks"""
        from datetime import datetime, timezone

        tasks = self.list_tasks(include_done=False)
        now = datetime.now(timezone.utc).isoformat()

        overdue = []
        for task in tasks:
            due_date = task.get("due_date", "")
            if due_date and not due_date.startswith("0001") and due_date < now:
                overdue.append(task)

        return overdue

    # ===== BATCH OPERATIONS =====

    def create_tasks_batch(self, tasks: List[Dict]) -> List[Dict]:
        """
        Create multiple tasks

        Args:
            tasks: List of task payloads with project_id

        Returns:
            List of created tasks
        """
        results = []
        for task_data in tasks:
            project_id = task_data.pop("project_id", 1)
            try:
                result = self.create_task(project_id, task_data)
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "task": task_data})

        return results

    # ===== HELPER METHODS =====

    def build_task_payload(self, parsed_data: Dict) -> tuple[Dict, int]:
        """
        Build Vikunja task payload from parsed NLP data

        Args:
            parsed_data: Parsed task data from NLP engine

        Returns:
            Tuple of (payload, project_id)
        """
        project_id = parsed_data.get("project_id", 1)

        # Convert label titles to label objects with IDs
        labels = []
        for label_data in parsed_data.get("labels", []):
            if isinstance(label_data, dict):
                label_title = label_data.get("title", "")
                label_color = label_data.get("hex_color", "")
            else:
                label_title = str(label_data)
                label_color = ""

            if label_title:
                try:
                    label_id = self.get_or_create_label(label_title, label_color)
                    labels.append({"id": label_id})
                except Exception:
                    pass

        payload = {
            "title": parsed_data.get("title") or "Untitled Task",
            "description": parsed_data.get("description", ""),
            "due_date": parsed_data.get("due_date", "0001-01-01T00:00:00Z"),
            "start_date": parsed_data.get("start_date", "0001-01-01T00:00:00Z"),
            "priority": parsed_data.get("priority", 0),
            "repeat_after": parsed_data.get("repeat_after", 0),
            "repeat_mode": parsed_data.get("repeat_mode", 0),
            "labels": labels,
        }

        if parsed_data.get("reminders"):
            payload["reminders"] = parsed_data["reminders"]

        return payload, project_id

    @staticmethod
    def is_zero_date(date_str: str) -> bool:
        """Check if date is zero/null"""
        return not date_str or date_str.startswith("0001")
