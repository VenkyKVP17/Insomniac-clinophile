"""
Vikunja NLP - Comprehensive Natural Language Processing for Task Management
VPK's Pantheon - Personal AI Assistant Ecosystem

This module provides advanced natural language understanding for Vikunja tasks,
including entity extraction, context awareness, and LLM-powered parsing.
"""

__version__ = "1.0.0"
__author__ = "VPK"
__description__ = "Comprehensive NLP for Vikunja Task Management"

from .engine import VikunjaEngine
from .api_client import VikunjaClient

__all__ = ["VikunjaEngine", "VikunjaClient"]
