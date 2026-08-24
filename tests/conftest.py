"""
Shared pytest fixtures.

Every test that touches the database gets a fresh in-memory SQLite database
(isolated per test via FastAPI dependency overrides - NOT via mutating the
`DATABASE_URL` env var, since the app's engine is a module-level singleton
created once at import time). Every test that would otherwise call a real
LLM provider injects a `MagicMock` instead - the whole suite runs with zero
network calls and zero API keys required.
"""

import os
import sys
import tempfile
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Point the app's default/global engine at a throwaway file (used only by the
# on-startup `init_db()` call) so running the test suite never creates or
# touches `resume_screener.db` in the repository root. Must be set before
# `app.db.database` is imported for the first time anywhere in the session.
os.environ.setdefault(
    "DATABASE_URL", f"sqlite:///{tempfile.gettempdir()}/resume_screener_test_default.db"
)


@pytest.fixture()
def fake_llm() -> MagicMock:
    """A mock LLM provider-facade with sensible default canned responses."""
    llm = MagicMock()
    llm.extract_resume.return_value = {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phone": None,
        "skills": [
            {"name": "Python", "category": "programming", "evidence": "used daily"},
            {"name": "ML", "category": "ai", "evidence": "built models"},
            {"name": "FastAPI", "category": "framework", "evidence": "built APIs"},
        ],
        "experience": [
            {
                "company": "Acme",
                "role": "ML Engineer",
                "duration_months": 30,
                "description": "Built and deployed ML models using PyTorch",
            }
        ],
        "education": [
            {
                "degree": "B.Tech",
                "field": "Computer Science",
                "institution": "XYZ University",
                "graduation_year": 2021,
            }
        ],
        "projects": [],
        "total_experience_months": None,
    }
    llm.extract_job.return_value = {
        "title": "Machine Learning Engineer",
        "required_skills": ["Python", "Machine Learning", "PyTorch"],
        "preferred_skills": ["Docker", "AWS", "FastAPI"],
        "minimum_experience_months": 24,
        "education_requirements": ["Computer Science"],
        "responsibilities": ["Build machine learning models", "Deploy ML services"],
    }
    llm.match_candidate.return_value = {
        "matched_required_skills": ["Python", "Machine Learning", "PyTorch"],
        "missing_required_skills": [],
        "matched_preferred_skills": ["FastAPI"],
        "missing_preferred_skills": ["Docker", "AWS"],
        "relevant_experience": [
            {"evidence": "ML Engineer role building/deploying models", "relevance": "high"}
        ],
        "strengths": ["Strong Python/ML background"],
        "weaknesses": ["No AWS evidence"],
        "semantic_fit_score": 9,
        "justification": "Strong fit for the ML engineer role.",
    }
    return llm


@pytest.fixture()
def test_client(fake_llm) -> Iterator["TestClient"]:  # noqa: F821
    """
    A FastAPI TestClient backed by a fresh in-memory SQLite database (via a
    `get_db` dependency override) and a mocked LLM (via `get_extraction_service`
    / `get_matching_service` overrides), so integration tests exercise all
    *real* business logic - parsing, normalization, scoring, ranking,
    persistence, HTTP status codes - without any network calls or shared
    state between tests.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.db.database import Base, get_db
    # Import models so they register on Base.metadata before create_all runs.
    from app.models import candidate, company, job, refresh_token, screening, user  # noqa: F401

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Iterator:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    from fastapi.testclient import TestClient

    from app.main import app
    from app.services.extraction_service import ExtractionService, get_extraction_service
    from app.services.matching_service import MatchingService, get_matching_service

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_extraction_service] = lambda: ExtractionService(
        llm_service=fake_llm
    )
    app.dependency_overrides[get_matching_service] = lambda: MatchingService(llm_service=fake_llm)

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
    engine.dispose()


# --- Auth test helpers (Phase 7) --------------------------------------------
#
# Factory fixtures (not plain functions) so any test file can use them
# without an import, matching this file's existing fixture-based convention.


@pytest.fixture()
def register_user():
    """Registers a brand-new company + ADMIN user and returns the TokenResponse body."""

    def _register(
        client,
        *,
        email="admin@acme.dev",
        password="SuperSecret123!",
        first_name="Ada",
        last_name="Admin",
        company_name="Acme Inc",
    ) -> dict:
        resp = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": password,
                "first_name": first_name,
                "last_name": last_name,
                "company_name": company_name,
            },
        )
        assert resp.status_code == 201, resp.text
        return resp.json()

    return _register


@pytest.fixture()
def login_user():
    """Logs an existing user in and returns the TokenResponse body."""

    def _login(client, *, email, password) -> dict:
        resp = client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, resp.text
        return resp.json()

    return _login


@pytest.fixture()
def auth_headers():
    """Builds an `Authorization: Bearer ...` header dict from a TokenResponse body."""

    def _headers(token_response: dict) -> dict:
        return {"Authorization": f"Bearer {token_response['access_token']}"}

    return _headers


@pytest.fixture()
def upload_resume():
    """Uploads a canned resume with the given auth headers, returns the candidate_id."""

    def _upload(client, headers, filename="resume.txt") -> str:
        import io

        content = (
            b"Jane Smith\nEmail: jane@example.com\nSkills: Python, ML, FastAPI\n"
            b"Experience: ML Engineer at Acme, 30 months, built and deployed ML models\n"
            b"Education: B.Tech Computer Science, XYZ University, 2021\n"
        )
        resp = client.post(
            "/api/resumes/upload",
            files={"file": (filename, io.BytesIO(content), "text/plain")},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["candidate_id"]

    return _upload


@pytest.fixture()
def create_job():
    """Creates a canned job with the given auth headers, returns the job_id."""

    def _create(client, headers) -> str:
        resp = client.post(
            "/api/jobs",
            json={
                "description": (
                    "We are hiring a Machine Learning Engineer. Required: Python, "
                    "Machine Learning, PyTorch. Preferred: Docker, AWS, FastAPI. "
                    "Minimum 2 years experience. Requires a degree in Computer Science. "
                    "Responsibilities: build machine learning models and deploy ML services."
                )
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["job_id"]

    return _create
