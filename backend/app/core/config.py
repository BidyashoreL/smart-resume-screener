"""
Application configuration.

All configuration is loaded from environment variables (via a .env file in
development). Nothing here should hard-code secrets. See `.env.example` at
the repository root for the full list of supported variables.
"""

from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General ---
    app_name: str = "Smart Resume Screener"
    environment: Literal["development", "test", "production"] = "development"

    # --- LLM provider selection ---
    llm_provider: Literal["gemini", "openrouter"] = "gemini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"

    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"

    llm_request_timeout_seconds: int = 60
    llm_max_retries: int = 2

    # --- Database ---
    database_url: str = "sqlite:///./resume_screener.db"

    # --- Authentication (Phase 7) ---
    # SECURITY: jwt_secret_key MUST be overridden via the JWT_SECRET_KEY env
    # var outside local development - see .env.example. Tokens signed with
    # the fallback below must never be trusted in a shared/production env.
    jwt_secret_key: str = "dev-insecure-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_cookie_name: str = "resume_screener_refresh_token"

    # --- CORS ---
    # The frontend's origin, used both for CORS and for scoping the refresh
    # cookie. Wildcard origins are incompatible with allow_credentials=True.
    frontend_origin: str = "http://localhost:5173"

    # --- File upload constraints ---
    max_file_size_mb: int = 10
    allowed_resume_extensions: tuple[str, ...] = (".pdf", ".txt")
    upload_dir: str = "backend/app/uploads"

    # --- Scoring weights (must sum to 1.0) ---
    weight_required_skills: float = 0.45
    weight_experience: float = 0.30
    weight_responsibilities: float = 0.15
    weight_education: float = 0.10

    # --- Ranking bands (inclusive lower bound, on a 0-100 scale) ---
    band_strong_match: int = 90
    band_good_match: int = 75
    band_partial_match: int = 60

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so we parse the environment only once."""
    return Settings()
