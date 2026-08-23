"""
Common interface every LLM provider must implement.

Nothing outside `app/services/llm_service.py` should import a concrete
provider directly - this keeps Gemini/OpenRouter-specific SDK code isolated
in exactly one place each, per the project's provider-agnostic architecture.
"""

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """A provider takes a system + user prompt and returns raw text (expected to be JSON)."""

    name: str = "base"

    @abstractmethod
    def generate_json(self, system_prompt: str, user_prompt: str) -> str:
        """
        Call the underlying model and return its raw text response.

        Implementations should request/force JSON output where the provider
        supports it, but must NOT attempt to parse JSON themselves - parsing,
        validation, and retry-on-malformed-JSON all live in `llm_service.py`
        so that behavior is identical regardless of provider.
        """
        raise NotImplementedError


class LLMProviderConnectionError(Exception):
    """Raised by a provider implementation when the API call itself fails
    (network error, auth error, rate limit, timeout, etc). Caught and wrapped
    by `llm_service.py` into `app.core.exceptions.LLMProviderError`."""
