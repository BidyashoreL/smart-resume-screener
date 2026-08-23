"""
OpenRouter provider - kept as an optional fallback so the LLM layer isn't
locked to a single vendor. OpenRouter exposes an OpenAI-compatible REST API,
so this is a plain HTTP call rather than a dedicated SDK.
"""

import requests

from app.core.config import get_settings
from app.services.llm_providers.base import LLMProvider, LLMProviderConnectionError

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openrouter_api_key:
            raise LLMProviderConnectionError(
                "OPENROUTER_API_KEY is not set. Add it to your .env file."
            )
        self._api_key = settings.openrouter_api_key
        self._model = settings.openrouter_model
        self._timeout = settings.llm_request_timeout_seconds

    def generate_json(self, system_prompt: str, user_prompt: str) -> str:
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                },
                timeout=self._timeout,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:
            raise LLMProviderConnectionError(f"OpenRouter request failed: {exc}") from exc
