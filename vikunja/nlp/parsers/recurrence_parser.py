#!/usr/bin/env python3
"""
Recurrence Parser for Vikunja NLP
Handles recurring/repeating task patterns
"""

import re
from typing import Tuple, Optional

class RecurrenceParser:
    """Parse recurrence patterns from natural language"""

    # Recurrence patterns: (regex, seconds, mode)
    # mode: 0=seconds-based, 1=month-based, 2=year-based
    PATTERNS = [
        # Simple frequencies
        (r"\bevery\s+day\b|\bdaily\b", 86400, 0),
        (r"\bevery\s+week\b|\bweekly\b", 604800, 0),
        (r"\bevery\s+month\b|\bmonthly\b", 2592000, 1),
        (r"\bevery\s+year\b|\bannually\b|\byearly\b", 31536000, 2),

        # Numeric intervals
        (r"\bevery\s+(\d+)\s+days?\b", None, 0),
        (r"\bevery\s+(\d+)\s+hours?\b", None, 0),
        (r"\bevery\s+(\d+)\s+weeks?\b", None, 0),
        (r"\bevery\s+(\d+)\s+months?\b", None, 1),

        # Specific weekdays
        (r"\bevery\s+(mon|tue|wed|thu|fri|sat|sun)\w*\b", 604800, 0),

        # "Repeat" variations
        (r"\brepeat(?:s|ing)?\s+daily\b", 86400, 0),
        (r"\brepeat(?:s|ing)?\s+weekly\b", 604800, 0),
        (r"\brepeat(?:s|ing)?\s+monthly\b", 2592000, 1),

        # Special patterns
        (r"\bweekdays?\b|\bevery\s+weekday\b", None, 0),  # Mon-Fri
        (r"\bweekends?\b|\bevery\s+weekend\b", None, 0),  # Sat-Sun
    ]

    def __init__(self):
        """Initialize recurrence parser"""
        self.compiled_patterns = [
            (re.compile(pat, re.I), sec, mode)
            for pat, sec, mode in self.PATTERNS
        ]

    def parse(self, text: str) -> Tuple[int, int, str]:
        """
        Parse recurrence from text

        Args:
            text: Natural language text

        Returns:
            Tuple of (repeat_after_seconds, repeat_mode, cleaned_text)
            repeat_mode: 0=seconds-based, 1=month-based, 2=year-based
        """
        for pattern, seconds, mode in self.compiled_patterns:
            match = pattern.search(text)
            if match:
                # Calculate seconds if pattern has dynamic value
                if seconds is None:
                    if "weekday" in match.group(0).lower():
                        # Every weekday (Mon-Fri): repeat every 1 day (Vikunja handles weekday logic)
                        seconds = 86400
                    elif "weekend" in match.group(0).lower():
                        # Every weekend (Sat-Sun): repeat every 7 days starting on Saturday
                        seconds = 604800
                    elif match.groups():
                        # Extract numeric value
                        num = int(match.group(1))
                        if "hour" in match.group(0).lower():
                            seconds = num * 3600
                        elif "day" in match.group(0).lower():
                            seconds = num * 86400
                        elif "week" in match.group(0).lower():
                            seconds = num * 604800
                        elif "month" in match.group(0).lower():
                            seconds = num * 2592000
                            mode = 1

                # Remove matched pattern from text
                cleaned = text[:match.start()] + " " + text[match.end():]
                return seconds, mode, cleaned.strip()

        return 0, 0, text

    @staticmethod
    def format_recurrence(seconds: int, mode: int) -> str:
        """
        Format recurrence for human reading

        Args:
            seconds: Repeat interval in seconds
            mode: Repeat mode

        Returns:
            Human-readable string
        """
        if seconds == 0:
            return "None"

        if mode == 2:  # Year-based
            years = seconds // 31536000
            return f"Every {years} year{'s' if years > 1 else ''}"

        if mode == 1:  # Month-based
            months = seconds // 2592000
            return f"Every {months} month{'s' if months > 1 else ''}"

        # Seconds-based
        if seconds >= 604800:
            weeks = seconds // 604800
            return f"Every {weeks} week{'s' if weeks > 1 else ''}"
        elif seconds >= 86400:
            days = seconds // 86400
            return f"Every {days} day{'s' if days > 1 else ''}"
        elif seconds >= 3600:
            hours = seconds // 3600
            return f"Every {hours} hour{'s' if hours > 1 else ''}"
        else:
            return f"Every {seconds} seconds"
