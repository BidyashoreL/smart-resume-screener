"""
Structured extraction: turns raw resume/job text into a validated
`CandidateProfile` / `JobProfile` via the LLM, with every response checked
against the Pydantic schema before it is trusted anywhere else in the system.

If the LLM returns data that doesn't match the schema, we raise
`SchemaValidationError` rather than silently coercing or discarding fields -
per the spec's "never invent candidate facts" principle, a broken response
should fail loudly rather than produce a plausible-looking but wrong profile.
"""

from pydantic import ValidationError

from app.core.exceptions import SchemaValidationError
from app.core.logging import get_logger
from app.schemas.candidate import CandidateProfile
from app.schemas.job import JobProfile
from app.services.llm_service import LLMService, get_llm_service

logger = get_logger(__name__)


class ExtractionService:
    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service or get_llm_service()

    def extract_candidate_profile(self, resume_text: str) -> CandidateProfile:
        raw = self._llm_service.extract_resume(resume_text)
        try:
            profile = CandidateProfile.model_validate(raw)
        except ValidationError as exc:
            logger.error("Resume extraction failed schema validation: %s", exc)
            raise SchemaValidationError(
                "The LLM's resume extraction did not match the expected candidate schema."
            ) from exc

        # Backfill total_experience_months deterministically if the LLM omitted it -
        # this is a simple sum, not an inference of facts, so it's safe to compute here
        # rather than trusting the LLM's arithmetic.
        if profile.total_experience_months is None:
            known_durations = [e.duration_months for e in profile.experience if e.duration_months]
            if known_durations:
                profile.total_experience_months = sum(known_durations)

        return profile

    def extract_job_profile(self, job_description: str) -> JobProfile:
        raw = self._llm_service.extract_job(job_description)
        try:
            return JobProfile.model_validate(raw)
        except ValidationError as exc:
            logger.error("Job extraction failed schema validation: %s", exc)
            raise SchemaValidationError(
                "The LLM's job extraction did not match the expected job schema."
            ) from exc


_extraction_service_singleton: ExtractionService | None = None


def get_extraction_service() -> ExtractionService:
    global _extraction_service_singleton
    if _extraction_service_singleton is None:
        _extraction_service_singleton = ExtractionService()
    return _extraction_service_singleton
