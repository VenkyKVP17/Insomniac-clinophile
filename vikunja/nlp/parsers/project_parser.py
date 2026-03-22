#!/usr/bin/env python3
"""
Project Parser for Vikunja NLP
Auto-detects and routes tasks to appropriate projects based on keywords
"""

import re
from typing import Optional, Tuple, Dict

class ProjectParser:
    """Parse project assignments from natural language"""

    # Default project hints (can be overridden via config)
    DEFAULT_HINTS = {
        "health": ["health", "fitness", "workout", "gym", "doctor", "medical"],
        "finance": ["finance", "money", "pay", "bill", "budget", "expense"],
        "study": ["study", "exam", "learn", "lecture", "mba", "assignment"],
        "work": ["work", "meeting", "report", "office", "client"],
        "home": ["home", "house", "clean", "repair", "maintenance"],
        "duty": ["duty", "hospital", "apollo", "ward", "shift", "rounds"],
        "errands": ["errand", "grocery", "shopping", "buy", "pickup"],
        "personal": ["personal", "self", "grooming", "haircut"],
    }

    def __init__(self, project_hints: Optional[Dict[str, list]] = None):
        """
        Initialize project parser

        Args:
            project_hints: Custom project→keywords mapping
        """
        self.hints = project_hints or self.DEFAULT_HINTS

        # Build reverse mapping (keyword → project)
        self.keyword_to_project = {}
        for project, keywords in self.hints.items():
            for keyword in keywords:
                self.keyword_to_project[keyword.lower()] = project

    def parse(self, text: str, project_map: Optional[Dict[str, int]] = None) -> Tuple[Optional[str], Optional[str], str]:
        """
        Parse project from text

        Args:
            text: Natural language text
            project_map: Dictionary mapping project names to IDs

        Returns:
            Tuple of (project_name, explicit_mention, cleaned_text)
        """
        # Check for explicit @project mentions
        explicit_matches = re.findall(r"@([\w-]+)", text)
        if explicit_matches:
            explicit_project = explicit_matches[0]
            # Remove @project mentions from text
            cleaned = re.sub(r"@[\w-]+", " ", text)
            return explicit_project, explicit_project, cleaned.strip()

        # Check for implicit project hints in text
        text_lower = text.lower()
        for keyword, project in self.keyword_to_project.items():
            if re.search(rf"\b{re.escape(keyword)}\b", text_lower):
                # Don't remove implicit keywords from text
                return project, None, text

        # No project found
        return None, None, text

    def resolve_project_id(self, project_name: Optional[str], project_map: Dict[str, int], default_id: int = 1) -> int:
        """
        Resolve project name to ID

        Args:
            project_name: Project name or hint
            project_map: Dictionary mapping project names to IDs (lowercase keys)
            default_id: Default project ID if not found

        Returns:
            Project ID
        """
        if not project_name:
            return default_id

        project_lower = project_name.lower()

        # Direct match
        if project_lower in project_map:
            return project_map[project_lower]

        # Fuzzy match (contains or is contained)
        for name, pid in project_map.items():
            if project_lower in name or name in project_lower:
                return pid

        return default_id

    @staticmethod
    def extract_labels(text: str) -> Tuple[list, str]:
        """
        Extract #hashtag labels from text

        Args:
            text: Natural language text

        Returns:
            Tuple of (labels_list, cleaned_text)
        """
        labels = re.findall(r"#([\w-]+)", text)
        cleaned = re.sub(r"#[\w-]+", " ", text)
        return labels, cleaned.strip()
