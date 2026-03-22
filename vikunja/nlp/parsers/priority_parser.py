#!/usr/bin/env python3
"""
Priority Parser for Vikunja NLP
Extracts priority levels from keywords and emojis
"""

import re
from typing import Tuple

class PriorityParser:
    """Parse priority from natural language and emojis"""

    # Priority keyword mappings
    PRIORITY_KEYWORDS = {
        # Critical (5)
        "critical": 5,
        "crit": 5,
        "p0": 5,
        "emergency": 5,
        "‼️": 5,

        # Urgent (4)
        "urgent": 4,
        "asap": 4,
        "immediately": 4,
        "urgent": 4,
        "p1": 4,
        "⚠️": 4,
        "❗": 4,

        # High (3)
        "high": 3,
        "important": 3,
        "hipri": 3,
        "priority": 3,
        "p2": 3,
        "🟡": 3,

        # Medium (2)
        "medium": 2,
        "normal": 2,
        "med": 2,
        "moderate": 2,
        "p3": 2,

        # Low (1)
        "low": 1,
        "whenever": 1,
        "someday": 1,
        "lo": 1,
        "p4": 1,
        "p5": 1,
        "🟢": 1,
    }

    # Emoji priority mappings
    PRIORITY_EMOJIS = {
        "🔴": 5,  # Critical
        "🟠": 4,  # Urgent
        "🟡": 3,  # High
        "🟢": 1,  # Low
        "⚠️": 4,  # Warning
        "❗": 4,  # Exclamation
        "‼️": 5,  # Double exclamation
    }

    def __init__(self):
        """Initialize priority parser"""
        pass

    def parse(self, text: str) -> Tuple[int, str]:
        """
        Parse priority from text

        Args:
            text: Natural language text

        Returns:
            Tuple of (priority_level, cleaned_text)
            Priority levels: 0=none, 1=low, 2=medium, 3=high, 4=urgent, 5=critical
        """
        priority = 0
        cleaned = text

        # Check for emojis first
        for emoji, level in self.PRIORITY_EMOJIS.items():
            if emoji in cleaned:
                priority = max(priority, level)
                cleaned = cleaned.replace(emoji, " ")

        # Check for priority keywords
        for keyword, level in sorted(
            self.PRIORITY_KEYWORDS.items(),
            key=lambda x: -len(x[0])  # Match longer keywords first
        ):
            pattern = rf"\b{re.escape(keyword)}\b"
            if re.search(pattern, cleaned, re.I):
                priority = max(priority, level)
                cleaned = re.sub(pattern, " ", cleaned, flags=re.I)

        # Clean up extra spaces
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

        return priority, cleaned

    @staticmethod
    def get_priority_name(level: int) -> str:
        """Get human-readable priority name"""
        names = {
            0: "None",
            1: "Low",
            2: "Medium",
            3: "High",
            4: "Urgent",
            5: "Critical"
        }
        return names.get(level, "None")

    @staticmethod
    def get_priority_emoji(level: int) -> str:
        """Get emoji for priority level"""
        emojis = {
            0: "",
            1: "🟢",
            2: "⚪",
            3: "🟡",
            4: "🟠",
            5: "🔴"
        }
        return emojis.get(level, "")
