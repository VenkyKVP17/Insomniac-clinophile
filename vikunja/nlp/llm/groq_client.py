#!/usr/bin/env python3
"""
Groq LLM Client for Vikunja NLP
Handles LLM-powered task parsing when regex isn't sufficient
"""

import os
import json
import re
from typing import Optional, Dict
from groq import Groq


class GroqClient:
    """Client for Groq LLM API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.1,
        max_tokens: int = 500
    ):
        """
        Initialize Groq client

        Args:
            api_key: Groq API key (defaults to env GROQ_API)
            model: Model name
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
        """
        self.api_key = api_key or os.getenv("GROQ_API", "")
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

        if not self.api_key:
            raise ValueError("Groq API key not found. Set GROQ_API environment variable.")

        self.client = Groq(api_key=self.api_key)

    def parse_task(self, prompt: str) -> Optional[Dict]:
        """
        Parse task using LLM

        Args:
            prompt: Complete parsing prompt

        Returns:
            Parsed task data as dict, or None on error
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            raw = response.choices[0].message.content.strip()

            # Extract JSON from response (handles markdown code blocks)
            json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find raw JSON
                json_match = re.search(r"\{.*\}", raw, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    return None

            parsed = json.loads(json_str)
            return parsed

        except Exception as e:
            print(f"[Groq] Error: {e}")
            return None

    def chat(self, messages: list, **kwargs) -> Optional[str]:
        """
        Generic chat completion

        Args:
            messages: List of message dicts
            **kwargs: Additional parameters

        Returns:
            Response text or None
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", self.temperature),
                max_tokens=kwargs.get("max_tokens", self.max_tokens)
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            print(f"[Groq] Error: {e}")
            return None
