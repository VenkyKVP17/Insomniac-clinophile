#!/usr/bin/env python3
"""
Vikunja NLP Engine
Comprehensive natural language processor for task management
"""

import re
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, Optional, Tuple
from pathlib import Path

from .parsers import DateParser, PriorityParser, ProjectParser, RecurrenceParser
from .llm import GroqClient, TASK_PARSING_PROMPT
from .api_client import VikunjaClient

IST = ZoneInfo("Asia/Kolkata")


class VikunjaEngine:
    """
    Comprehensive NLP engine for Vikunja task management

    Features:
    - Multi-stage parsing (emoji → tags → repeat → datetime → priority → project)
    - LLM fallback for complex queries
    - Context awareness
    - Smart defaults
    """

    def __init__(
        self,
        vikunja_client: Optional[VikunjaClient] = None,
        use_llm: bool = True,
        groq_api_key: Optional[str] = None
    ):
        """
        Initialize NLP engine

        Args:
            vikunja_client: Vikunja API client (creates default if None)
            use_llm: Enable LLM-powered parsing
            groq_api_key: Groq API key for LLM
        """
        self.vikunja = vikunja_client or VikunjaClient()
        self.use_llm = use_llm and bool(groq_api_key or os.getenv("GROQ_API"))

        # Initialize parsers
        self.date_parser = DateParser()
        self.priority_parser = PriorityParser()
        self.project_parser = ProjectParser()
        self.recurrence_parser = RecurrenceParser()

        # Initialize LLM client if enabled
        self.llm = None
        if self.use_llm:
            try:
                self.llm = GroqClient(api_key=groq_api_key)
            except Exception as e:
                print(f"[Engine] LLM initialization failed: {e}")
                self.use_llm = False

        # Cache project map
        self._project_map = None
        self._project_map_timestamp = None

    def get_project_map(self, force_refresh: bool = False) -> Dict[str, int]:
        """
        Get project name→ID mapping with caching

        Args:
            force_refresh: Force refresh cache

        Returns:
            Project map
        """
        now = datetime.now()

        # Refresh if cache is empty or older than 5 minutes
        if (
            force_refresh
            or self._project_map is None
            or self._project_map_timestamp is None
            or (now - self._project_map_timestamp).total_seconds() > 300
        ):
            self._project_map = self.vikunja.get_project_map()
            self._project_map_timestamp = now

        return self._project_map

    def parse(
        self,
        text: str,
        context: Optional[str] = None,
        default_project: str = "inbox"
    ) -> Dict:
        """
        Parse natural language into structured task data

        Args:
            text: Natural language task description
            context: Additional context about the user
            default_project: Default project name if none detected

        Returns:
            Parsed task data dictionary
        """
        original_text = text
        # Initialize result
        result = {
            "title": "",
            "description": "",
            "due_date": self.date_parser.to_vikunja_format(None),
            "start_date": self.date_parser.to_vikunja_format(None),
            "priority": 0,
            "labels": [],
            "project_id": 1,
            "repeat_after": 0,
            "repeat_mode": 0,
            "reminders": []
        }

        # Stage 1: Extract emojis and priority
        priority_emoji, text = self.priority_parser.parse(text)
        result["priority"] = priority_emoji

        # Stage 2: Extract hashtags and @mentions
        labels, text = self.project_parser.extract_labels(text)
        project_hint, explicit_project, text = self.project_parser.parse(text)

        result["labels"] = [{"title": label, "hex_color": ""} for label in labels]

        # Stage 3: Extract recurrence patterns
        repeat_after, repeat_mode, text = self.recurrence_parser.parse(text)
        result["repeat_after"] = repeat_after
        result["repeat_mode"] = repeat_mode

        # Stage 4: Extract reminder phrases
        text, reminder_phrase = self._extract_reminder(text)

        # Stage 5: Extract dates and times
        due_date, start_date, text = self.date_parser.parse(text)

        if due_date:
            result["due_date"] = self.date_parser.to_vikunja_format(due_date)
        if start_date:
            result["start_date"] = self.date_parser.to_vikunja_format(start_date)

        # Stage 6: Handle reminders
        if reminder_phrase:
            reminder_dt = self.date_parser.parse_reminder(reminder_phrase, due_date)
            if reminder_dt:
                result["reminders"] = [{
                    "reminder": self.date_parser.to_vikunja_format(reminder_dt)
                }]
        elif due_date and not reminder_phrase:
            # Default reminder: 30 minutes before
            default_reminder = due_date - timedelta(minutes=30)
            result["reminders"] = [{
                "reminder": self.date_parser.to_vikunja_format(default_reminder)
            }]

        # Stage 7: Extract priority keywords
        priority_kw, text = self.priority_parser.parse(text)
        if priority_kw and not result["priority"]:
            result["priority"] = priority_kw

        # Stage 8: Resolve project
        project_map = self.get_project_map()
        default_pid = project_map.get(default_project.lower(), 1)

        if explicit_project or project_hint:
            resolved_project = explicit_project or project_hint
            result["project_id"] = self.project_parser.resolve_project_id(
                resolved_project, project_map, default_pid
            )
        else:
            result["project_id"] = default_pid

        # Stage 9: Clean up title
        result["title"] = self._clean_text(text)
        if not result["title"]:
            result["title"] = self._clean_text(original_text)

        # Stage 10: LLM fallback if needed
        if self.use_llm and self._should_use_llm(result, text):
            llm_result = self._parse_with_llm(text, context, project_map)
            if llm_result:
                result = self._merge_results(result, llm_result, project_map)

        return result

    def _extract_reminder(self, text: str) -> Tuple[str, Optional[str]]:
        """Extract reminder phrases from text"""
        patterns = [
            r"remind(?:\s+me)?\s+(?:at\s+)?(.+?)(?=\s+(?:to|that|about|#|@|\bby\b|\bat\b)|$)",
            r"notify(?:\s+me)?\s+(?:at\s+)?(.+?)(?=\s+(?:to|that|about|#|@)|$)",
            r"alert\s+(?:at\s+)?(.+?)(?=\s+(?:to|that|about|#|@)|$)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                phrase = match.group(1).strip()
                cleaned = text[:match.start()] + " " + text[match.end():]
                return cleaned.strip(), phrase

        return text, None

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove multiple spaces
        text = re.sub(r"\s{2,}", " ", text)

        # Remove leading/trailing punctuation
        text = re.sub(r"^[\s,.:;!?-]+|[\s,.:;!?-]+$", "", text)

        # Remove trailing dangling prepositions/anchors
        text = re.sub(
            r"\b(?:at|by|on|for|the|a|an|next|this|every|in|from)\s*$",
            "", text, flags=re.I
        ).strip()

        # Remove leading frequency words if recurring
        text = re.sub(r"^\b(?:daily|weekly|monthly)\b\s*", "", text, flags=re.I).strip()

        return text.strip()

    def _should_use_llm(self, result: Dict, original_text: str) -> bool:
        """Determine if LLM should be used"""
        # Use LLM if:
        # 1. Title is empty or very short
        if not result["title"] or len(result["title"]) < 3:
            return True

        # 2. No due date extracted but text suggests temporal element
        if self.date_parser.is_zero(result["due_date"]):
            temporal_words = [
                "tomorrow", "today", "monday", "tuesday", "wednesday",
                "thursday", "friday", "saturday", "sunday", "next",
                "tonight", "morning", "evening", "pm", "am", "eod", "eow"
            ]
            if any(word in original_text.lower() for word in temporal_words):
                return True

        return False

    def _parse_with_llm(
        self,
        text: str,
        context: Optional[str],
        project_map: Dict[str, int]
    ) -> Optional[Dict]:
        """Parse using LLM"""
        if not self.llm:
            return None

        try:
            now_str = datetime.now(tz=IST).strftime("%Y-%m-%d %H:%M IST")
            projects_str = ", ".join(project_map.keys())

            prompt = TASK_PARSING_PROMPT(
                text=text,
                current_time=now_str,
                projects=projects_str,
                context=context or ""
            )

            result = self.llm.parse_task(prompt)
            return result

        except Exception as e:
            print(f"[Engine] LLM parsing error: {e}")
            return None

    def _merge_results(self, regex_result: Dict, llm_result: Dict, project_map: Dict) -> Dict:
        """Merge regex and LLM results intelligently"""
        merged = regex_result.copy()

        # Prefer LLM for title if regex title is poor
        if llm_result.get("title") and (
            not merged["title"] or len(merged["title"]) < 3
        ):
            merged["title"] = llm_result["title"]

        # Prefer LLM for dates if regex failed
        if llm_result.get("due_date") and self.date_parser.is_zero(merged["due_date"]):
            merged["due_date"] = llm_result["due_date"]

        if llm_result.get("start_date") and self.date_parser.is_zero(merged["start_date"]):
            merged["start_date"] = llm_result["start_date"]

        # Prefer LLM for priority if regex found none
        if llm_result.get("priority") and not merged["priority"]:
            merged["priority"] = llm_result["priority"]

        # Merge labels
        existing_labels = {l["title"].lower() for l in merged["labels"]}
        for label in llm_result.get("labels", []):
            if isinstance(label, str) and label.lower() not in existing_labels:
                merged["labels"].append({"title": label, "hex_color": ""})

        # Prefer LLM for project if regex used default
        if llm_result.get("project_id"):
            llm_project = llm_result["project_id"]
            llm_pid = self.project_parser.resolve_project_id(llm_project, project_map, merged["project_id"])
            if llm_pid != merged["project_id"]:
                merged["project_id"] = llm_pid

        # Prefer LLM for recurrence if regex found none
        if llm_result.get("repeat_after") and not merged["repeat_after"]:
            merged["repeat_after"] = llm_result["repeat_after"]
            merged["repeat_mode"] = llm_result.get("repeat_mode", 0)

        # Use LLM description if provided
        if llm_result.get("description"):
            merged["description"] = llm_result["description"]

        return merged

    def create_task(self, text: str, context: Optional[str] = None, dry_run: bool = False) -> Dict:
        """
        Parse and create task in Vikunja

        Args:
            text: Natural language task
            context: User context
            dry_run: If True, only parse without creating

        Returns:
            Created task data or parsed data if dry_run
        """
        parsed = self.parse(text, context=context)

        if dry_run:
            return parsed

        # Build payload and create
        payload, project_id = self.vikunja.build_task_payload(parsed)
        result = self.vikunja.create_task(project_id, payload)

        return result
