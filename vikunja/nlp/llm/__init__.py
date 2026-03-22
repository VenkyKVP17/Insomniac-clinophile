"""
LLM Integration for Vikunja NLP
"""

from .groq_client import GroqClient
from .prompts import TASK_PARSING_PROMPT

__all__ = ["GroqClient", "TASK_PARSING_PROMPT"]
