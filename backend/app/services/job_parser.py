"""
Raw job-description text handling - the job-description counterpart to
`resume_parser.py`. Job descriptions arrive as pasted text (see
`schemas/job.JobCreateRequest`), so this module's job is mainly validation
and cleanup rather than file-format extraction, but it's kept as its own
module so a future file/URL-based job import can plug in here without
touching `extraction_service.py`.
"""

from app.core.exceptions import TextExtractionError
from app.services.resume_parser import clean_text

MIN_DESCRIPTION_CHARS = 20


def parse_job_description(raw_description: str) -> str:
    """Validate and clean a raw job description string."""
    if raw_description is None or len(raw_description.strip()) < MIN_DESCRIPTION_CHARS:
        raise TextExtractionError(
            f"Job description text is too short (minimum {MIN_DESCRIPTION_CHARS} characters)."
        )
    return clean_text(raw_description)
