"""
Input handlers for different platforms (Telegram, Discord, etc.)
"""

from .telegram_handler import TelegramTaskHandler
from .discord_handler import DiscordTaskHandler

__all__ = ["TelegramTaskHandler", "DiscordTaskHandler"]
