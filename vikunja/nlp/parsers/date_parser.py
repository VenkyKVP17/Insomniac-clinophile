#!/usr/bin/env python3
"""
Advanced Date and Time Parser for Vikunja NLP
Handles complex temporal expressions, relative dates, and IST timezone
"""

import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Tuple
import dateparser

IST = ZoneInfo("Asia/Kolkata")

class DateParser:
    """Parse dates and times from natural language"""

    # Time patterns for compound expressions
    _TIME = r"(?:at\s+)?(?:\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m|noon|midnight|morning|afternoon|evening|night)"
    _WEEKDAY = r"(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)"
    _MONTH = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"

    # Comprehensive date patterns (ordered by specificity)
    DATE_PATTERNS = [
        # Compound date+time patterns (highest priority)
        rf"\bthe\s+day\s+after\s+tomorrow\s+{_TIME}\b",
        rf"\b(?:tomorrow|today)\s+{_TIME}\b",
        rf"\bnext\s+{_WEEKDAY}\s+{_TIME}\b",
        rf"\bthis\s+{_WEEKDAY}\s+{_TIME}\b",
        rf"\b{_MONTH}\s+\d{{1,2}}(?:\s*,?\s*\d{{4}})?\s+{_TIME}\b",
        rf"\b\d{{1,2}}\s+{_MONTH}(?:\s+\d{{4}})?\s+{_TIME}\b",

        # Date anchors (standalone)
        r"\bthe\s+day\s+after\s+tomorrow\b",
        r"\bday\s+after\s+tomorrow\b",
        r"\bovermorrow\b",
        rf"\bnext\s+{_WEEKDAY}\b",
        rf"\bthis\s+{_WEEKDAY}\b",
        rf"\bcoming\s+{_WEEKDAY}\b",
        r"\bnext\s+(?:week|month|year)\b",
        r"\bthis\s+(?:week(?:end)?|month|year|evening|afternoon|morning|night)\b",
        r"\btoday\b",
        r"\btomorrow\b",
        r"\btonite\b",
        r"\btonight\b",
        r"\byesterday\b",

        # Relative time expressions
        r"\bin\s+\d+\s+(?:min(?:ute)?s?|hours?|days?|weeks?|months?|years?)\b",
        r"\bafter\s+\d+\s+(?:min(?:ute)?s?|hours?|days?|weeks?|months?)\b",
        r"\b\d+\s+(?:min(?:ute)?s?|hours?|days?|weeks?|months?)\s+from\s+now\b",

        # Specific date formats
        r"\b\d{4}-\d{2}-\d{2}\b",  # ISO format
        r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",  # DD/MM/YYYY or similar
        rf"\b{_MONTH}\s+\d{{1,2}}(?:\s*,?\s*\d{{4}})?\b",  # March 15, 2026
        rf"\b\d{{1,2}}\s+{_MONTH}(?:\s+\d{{4}})?\b",  # 15 March 2026
        rf"\b\d{{1,2}}(?:st|nd|rd|th)\s+{_MONTH}(?:\s+\d{{4}})?\b",  # 15th March 2026

        # Time expressions (standalone)
        r"\b(?:at\s+)?(?:\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)\b",
        r"\b(?:noon|midnight)\b",
        r"\b(?:morning|afternoon|evening|night)\b",

        # Weekdays (standalone, lowest priority)
        rf"\b{_WEEKDAY}\b",

        # Special abbreviations
        r"\beod\b",  # End of day
        r"\beow\b",  # End of week
        r"\beom\b",  # End of month
    ]

    DATEPARSER_SETTINGS = {
        "PREFER_DATES_FROM": "future",
        "RETURN_AS_TIMEZONE_AWARE": True,
        "TIMEZONE": "Asia/Kolkata",
        "PREFER_DAY_OF_MONTH": "first",
        "DATE_ORDER": "DMY",
        "RELATIVE_BASE": datetime.now(tz=IST)
    }

    def __init__(self, default_time: str = "09:00"):
        """
        Initialize date parser

        Args:
            default_time: Default time to use when only date is specified (HH:MM)
        """
        self.default_time = default_time
        self.patterns = [re.compile(p, re.I) for p in self.DATE_PATTERNS]

    def parse(self, text: str) -> Tuple[Optional[datetime], Optional[datetime], str]:
        """
        Parse dates from text

        Args:
            text: Natural language text

        Returns:
            Tuple of (due_date, start_date, cleaned_text)
        """
        now = datetime.now(tz=IST)
        due = None
        start = None
        consumed = []

        # Handle special abbreviations first
        if match := re.search(r"\beod\b", text, re.I):
            due = now.replace(hour=23, minute=59, second=0, microsecond=0)
            consumed.append(match.span())

        if not due and (match := re.search(r"\beow\b", text, re.I)):
            days_until_sunday = (6 - now.weekday()) % 7 or 7
            due = (now + timedelta(days=days_until_sunday)).replace(
                hour=23, minute=59, second=0, microsecond=0
            )
            consumed.append(match.span())

        if not due and (match := re.search(r"\beom\b", text, re.I)):
            # Last day of current month
            next_month = (now.replace(day=28) + timedelta(days=4)).replace(day=1)
            last_day = (next_month - timedelta(days=1))
            due = last_day.replace(hour=23, minute=59, second=0, microsecond=0)
            consumed.append(match.span())

        # Handle date ranges (start_date to due_date)
        if not due:
            range_match = re.search(
                r"(?:start(?:ing)?|from)\s+(.+?)\s+(?:to|un?till?|due|by|end(?:ing)?)\s+(.+?)"
                r"(?=\s+(?:#|@|\b(?:high|urgent|low|medium|critical|remind)\b)|$)",
                text, re.I
            )
            if range_match:
                start_str = range_match.group(1).strip()
                due_str = range_match.group(2).strip()

                start_parsed = dateparser.parse(start_str, settings=self.DATEPARSER_SETTINGS)
                due_parsed = dateparser.parse(due_str, settings=self.DATEPARSER_SETTINGS)

                if start_parsed and due_parsed:
                    start = start_parsed
                    due = due_parsed
                    consumed.append(range_match.span())

        # Try pattern-based matching if no range found
        if not due:
            for pattern in self.patterns:
                if match := pattern.search(text):
                    parsed = dateparser.parse(
                        match.group(0),
                        settings=self.DATEPARSER_SETTINGS
                    )
                    if parsed:
                        due = parsed
                        consumed.append(match.span())
                        break

        # Remove consumed spans from text
        for span_start, span_end in sorted(consumed, reverse=True):
            text = text[:span_start] + " " + text[span_end:]

        # Add default time if only date was specified (hour is midnight)
        if due and due.hour == 0 and due.minute == 0:
            hour, minute = map(int, self.default_time.split(":"))
            due = due.replace(hour=hour, minute=minute, second=0, microsecond=0)

        return due, start, text.strip()

    def parse_reminder(self, text: str, due_date: Optional[datetime] = None) -> Optional[datetime]:
        """
        Parse reminder time from text

        Args:
            text: Natural language text (e.g., "30 minutes before", "1 day prior")
            due_date: The task's due date (for relative reminders)

        Returns:
            Reminder datetime or None
        """
        # Relative to due date patterns
        relative_match = re.search(
            r"(\d+)\s*(min(?:ute)?s?|hours?|days?)\s+(?:before|prior|early|ahead)",
            text, re.I
        )
        if relative_match and due_date:
            num = int(relative_match.group(1))
            unit = relative_match.group(2).lower()

            if "min" in unit:
                return due_date - timedelta(minutes=num)
            elif "hour" in unit:
                return due_date - timedelta(hours=num)
            elif "day" in unit:
                return due_date - timedelta(days=num)

        # Absolute time parsing
        absolute_parsed = dateparser.parse(text, settings=self.DATEPARSER_SETTINGS)
        if absolute_parsed:
            return absolute_parsed

        # Default: X units before (without "before" keyword)
        simple_match = re.search(r"(\d+)\s*(min(?:ute)?s?|hours?|days?)", text, re.I)
        if simple_match and due_date:
            num = int(simple_match.group(1))
            unit = simple_match.group(2).lower()

            if "min" in unit:
                return due_date - timedelta(minutes=num)
            elif "hour" in unit:
                return due_date - timedelta(hours=num)
            elif "day" in unit:
                return due_date - timedelta(days=num)

        return None

    @staticmethod
    def to_vikunja_format(dt: Optional[datetime]) -> str:
        """Convert datetime to Vikunja API format (UTC ISO8601)"""
        if dt is None:
            return "0001-01-01T00:00:00Z"

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)

        return dt.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def is_zero(date_str: str) -> bool:
        """Check if a date string represents a zero/null date"""
        return not date_str or date_str.startswith("0001")
