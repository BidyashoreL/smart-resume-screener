"""
Google Gemini provider.

Chosen as the primary provider for this project because it removes the local
-model RAM constraint on memory-limited development machines while remaining
a strong general-purpose model for structured extraction and semantic
matching (see docs/architecture.md).
"""

import google.generativeai as genai

from app.core.config import get_settings
from app.services.llm_providers.base import LLMProvider, LLMProviderConnectionError


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise LLMProviderConnectionError(
                "GEMINI_API_KEY is not set. Add it to your .env file."
            )
        genai.configure(api_key=settings.gemini_api_key)
        self._model_name = settings.gemini_model
        self._timeout = settings.llm_request_timeout_seconds

    def generate_json(self, system_prompt: str, user_prompt: str) -> str:
        try:
            model = genai.GenerativeModel(
                model_name=self._model_name,
                system_instruction=system_prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            response = model.generate_content(
                user_prompt,
                request_options={"timeout": self._timeout},
            )
            return response.text
        except Exception as exc:  # SDK raises several distinct exception types
            raise LLMProviderConnectionError(f"Gemini request failed: {exc}") from exc
