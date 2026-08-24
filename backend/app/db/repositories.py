"""
Repository layer: the only place in the application that issues SQLAlchemy
queries. Routes and services depend on these functions rather than the ORM
directly, which keeps persistence swappable and keeps route handlers thin.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import CandidateNotFoundError, JobNotFoundError, ScreeningNotFoundError
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.screening import ScreeningResult


# --- Candidates ---------------------------------------------------------


def create_candidate(
    db: Session,
    *,
    name: str | None,
    email: str | None,
    phone: str | None,
    raw_text: str,
    structured_json: dict,
    file_path: str | None,
    original_filename: str | None,
) -> Candidate:
    candidate = Candidate(
        name=name,
        email=email,
        phone=phone,
        raw_text=raw_text,
        structured_json=structured_json,
        file_path=file_path,
        original_filename=original_filename,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def get_candidate(db: Session, candidate_id: str) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise CandidateNotFoundError(f"No candidate with id '{candidate_id}'.")
    return candidate


def list_candidates(db: Session) -> list[Candidate]:
    return list(db.query(Candidate).order_by(Candidate.created_at.desc()).all())


# --- Jobs ----------------------------------------------------------------


def create_job(db: Session, *, title: str | None, raw_description: str, structured_json: dict) -> Job:
    job = Job(title=title, raw_description=raw_description, structured_json=structured_json)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise JobNotFoundError(f"No job with id '{job_id}'.")
    return job


def list_jobs(db: Session) -> list[Job]:
    return list(db.query(Job).order_by(Job.created_at.desc()).all())


# --- Screening results -----------------------------------------------------


def create_screening_result(db: Session, **fields) -> ScreeningResult:
    result = ScreeningResult(**fields)
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_screening_batch(db: Session, batch_id: str) -> list[ScreeningResult]:
    results = (
        db.query(ScreeningResult)
        .filter(ScreeningResult.batch_id == batch_id)
        .order_by(ScreeningResult.overall_score.desc())
        .all()
    )
    if not results:
        raise ScreeningNotFoundError(f"No screening found with id '{batch_id}'.")
    return list(results)


def list_all_screening_results(db: Session) -> list[ScreeningResult]:
    return list(
        db.query(ScreeningResult)
        .order_by(ScreeningResult.created_at.desc())
        .all()
    )
