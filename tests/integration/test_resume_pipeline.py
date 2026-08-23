"""
Integration test for the full extraction pipeline:

    raw resume text -> document_service -> extraction_service -> CandidateProfile

using a mocked LLM (no network calls), to verify the pieces are wired
together correctly end-to-end rather than just individually.
"""

from app.services import document_service
from app.services.extraction_service import ExtractionService


def test_full_resume_pipeline_produces_valid_candidate_profile(fake_llm):
    raw_bytes = (
        b"Jane Smith\n"
        b"Email: jane@example.com\n"
        b"Skills: Python, ML, FastAPI\n"
        b"Experience: ML Engineer at Acme, 30 months\n"
        b"Education: B.Tech Computer Science, XYZ University, 2021\n"
    )

    extracted = document_service.validate_and_extract("jane_resume.txt", raw_bytes)
    assert extracted.raw_text  # extraction succeeded

    service = ExtractionService(llm_service=fake_llm)
    profile = service.extract_candidate_profile(extracted.raw_text)

    assert profile.name == "Jane Smith"
    assert profile.email == "jane@example.com"
    assert any(s.name == "Python" for s in profile.skills)
    assert profile.total_experience_months == 30  # backfilled from experience entries
    fake_llm.extract_resume.assert_called_once_with(extracted.raw_text)


def test_full_job_pipeline_produces_valid_job_profile(fake_llm):
    from app.services import job_parser
    from app.services.extraction_service import ExtractionService

    description = (
        "We are hiring a Machine Learning Engineer. Required: Python, Machine "
        "Learning, PyTorch. Preferred: Docker, AWS, FastAPI. Minimum 2 years "
        "experience. Requires a degree in Computer Science."
    )
    cleaned = job_parser.parse_job_description(description)

    service = ExtractionService(llm_service=fake_llm)
    profile = service.extract_job_profile(cleaned)

    assert profile.title == "Machine Learning Engineer"
    assert "Python" in profile.required_skills
    assert "Docker" in profile.preferred_skills
    assert profile.minimum_experience_months == 24
