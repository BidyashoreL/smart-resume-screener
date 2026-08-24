"""
Google Gemini provider.

Primary LLM provider for the Smart Resume Screener.

This module is intentionally the only place that knows about the
Google Gemini SDK. The rest of the application talks to the
provider through the LLMProvider interface.
"""

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.services.llm_providers.base import (
    LLMProvider,
    LLMProviderConnectionError,
)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        settings = get_settings()

        if not settings.gemini_api_key:
            raise LLMProviderConnectionError(
                "GEMINI_API_KEY is not set. Add it to your .env file."
            )

        self._client = genai.Client(
            api_key=settings.gemini_api_key,
        )

        self._model_name = settings.gemini_model

    def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Generate a JSON response from Gemini.

        JSON parsing is intentionally NOT performed here.
        LLMService owns parsing, validation, and retry behavior.
        """
        try:
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                ),
            )

            if not response.text:
                raise LLMProviderConnectionError(
                    "Gemini returned an empty response."
                )

            return response.text

        except LLMProviderConnectionError:
            raise

        except Exception as exc:
            raise LLMProviderConnectionError(
                f"Gemini request failed: {exc}"
            ) from exc