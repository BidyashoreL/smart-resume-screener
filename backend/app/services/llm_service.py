"""
LLM service facade.

This is the ONLY module the rest of the application talks to for LLM work.
It is responsible for:

  1. Choosing a provider based on configuration (`LLM_PROVIDER`).
  2. Loading and filling prompt templates from `app/prompts/`.
  3. Calling the provider and parsing its JSON response.
  4. Retrying on transient failures / malformed JSON.
  5. Translating provider failures into `LLMProviderError` so callers never
     see a provider-specific exception type.

Business logic (extraction_service, matching_service) calls:

    llm_service.extract_resume(resume_text)
    llm_service.extract_job(job_description)
    llm_service.match_candidate(candidate_json, job_json)

and never imports a provider directly.
"""

import json
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.core.exceptions import LLMProviderError
from app.core.logging import get_logger
from app.services.llm_providers.base import LLMProvider, LLMProviderConnectionError

logger = get_logger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


@lru_cache
def _load_prompt(filename: str) -> tuple[str, str]:
    """
    Load a prompt file and split it into (system_prompt, user_template).

    Prompt files use a `SYSTEM:` / `USER:` convention (see app/prompts/*.txt)
    purely for human readability in the repo; this parses that convention.
    """
    text = (PROMPTS_DIR / filename).read_text(encoding="utf-8")
    if "USER:" not in text:
        raise ValueError(f"Prompt file {filename} is missing a 'USER:' section")
    system_part, user_part = text.split("USER:", 1)
    system_prompt = system_part.replace("SYSTEM:", "", 1).strip()
    user_template = user_part.strip()
    return system_prompt, user_template


def _build_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm_provider == "gemini":
        from app.services.llm_providers.gemini_provider import GeminiProvider

        return GeminiProvider()
    if settings.llm_provider == "openrouter":
        from app.services.llm_providers.openrouter_provider import OpenRouterProvider

        return OpenRouterProvider()
    raise LLMProviderError(f"Unknown LLM_PROVIDER '{settings.llm_provider}'")


def _extract_json(raw_text: str) -> dict:
    """
    Best-effort JSON extraction. Most providers return clean JSON when asked,
    but some wrap it in markdown code fences - strip those before parsing.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


class LLMService:
    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider  # lazily built on first use if not injected (helps testing)
        self._settings = get_settings()

    @property
    def provider(self) -> LLMProvider:
        if self._provider is None:
            self._provider = _build_provider()
        return self._provider

    def _call(self, system_prompt: str, user_prompt: str) -> dict:
        last_error: Exception | None = None
        for attempt in range(1, self._settings.llm_max_retries + 2):
            try:
                raw = self.provider.generate_json(system_prompt, user_prompt)
                return _extract_json(raw)
            except LLMProviderConnectionError as exc:
                last_error = exc
                logger.warning("LLM call failed (attempt %d): %s", attempt, exc)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning("LLM returned malformed JSON (attempt %d): %s", attempt, exc)
        raise LLMProviderError(f"LLM provider '{self.provider.name}' failed: {last_error}")

    def extract_resume(self, resume_text: str) -> dict:
        system_prompt, template = _load_prompt("resume_extraction.txt")
        user_prompt = template.replace("{{resume_text}}", resume_text)
        return self._call(system_prompt, user_prompt)

    def extract_job(self, job_description: str) -> dict:
        system_prompt, template = _load_prompt("job_extraction.txt")
        user_prompt = template.replace("{{job_description}}", job_description)
        return self._call(system_prompt, user_prompt)

    def match_candidate(self, candidate_json: dict, job_json: dict) -> dict:
        system_prompt, template = _load_prompt("candidate_matching.txt")
        user_prompt = template.replace(
            "{{candidate_json}}", json.dumps(candidate_json, indent=2)
        ).replace("{{job_json}}", json.dumps(job_json, indent=2))
        return self._call(system_prompt, user_prompt)


@lru_cache
def get_llm_service() -> LLMService:
    return LLMService()
