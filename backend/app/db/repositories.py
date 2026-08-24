"""
Repository layer: the only place in the application that issues SQLAlchemy
queries. Routes and services depend on these functions rather than the ORM
directly, which keeps persistence swappable and keeps route handlers thin.

Every candidate/job/screening-result query is scoped by `company_id`
(Phase 7 multi-tenancy) - callers always pass the *authenticated user's*
company_id (see `app/core/deps.py`), never anything read from client input.
Filtering happens in the query itself (not "fetch, then check the id
matches") so a cross-tenant id behaves identically to an id that doesn't
exist at all: a plain 404, with no information leaked about whether the
record exists in someone else's company.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import CandidateNotFoundError, JobNotFoundError, ScreeningNotFoundError
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job
from app.models.refresh_token import RefreshToken
from app.models.screening import ScreeningResult
from app.models.user import User, UserRole


# --- Candidates ---------------------------------------------------------


def create_candidate(
    db: Session,
    *,
    company_id: str,
    name: str | None,
    email: str | None,
    phone: str | None,
    raw_text: str,
    structured_json: dict,
    file_path: str | None,
    original_filename: str | None,
) -> Candidate:
    candidate = Candidate(
        company_id=company_id,
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


def get_candidate(db: Session, candidate_id: str, company_id: str) -> Candidate:
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.company_id == company_id)
        .first()
    )
    if candidate is None:
        raise CandidateNotFoundError(f"No candidate with id '{candidate_id}'.")
    return candidate


def list_candidates(db: Session, company_id: str) -> list[Candidate]:
    return list(
        db.query(Candidate)
        .filter(Candidate.company_id == company_id)
        .order_by(Candidate.created_at.desc())
        .all()
    )


# --- Jobs ----------------------------------------------------------------


def create_job(
    db: Session, *, company_id: str, title: str | None, raw_description: str, structured_json: dict
) -> Job:
    job = Job(
        company_id=company_id, title=title, raw_description=raw_description, structured_json=structured_json
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str, company_id: str) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == company_id).first()
    if job is None:
        raise JobNotFoundError(f"No job with id '{job_id}'.")
    return job


def list_jobs(db: Session, company_id: str) -> list[Job]:
    return list(
        db.query(Job).filter(Job.company_id == company_id).order_by(Job.created_at.desc()).all()
    )


# --- Screening results -----------------------------------------------------


def create_screening_result(db: Session, **fields) -> ScreeningResult:
    result = ScreeningResult(**fields)
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_screening_batch(db: Session, batch_id: str, company_id: str) -> list[ScreeningResult]:
    results = (
        db.query(ScreeningResult)
        .filter(ScreeningResult.batch_id == batch_id, ScreeningResult.company_id == company_id)
        .order_by(ScreeningResult.overall_score.desc())
        .all()
    )
    if not results:
        raise ScreeningNotFoundError(f"No screening found with id '{batch_id}'.")
    return list(results)


def list_all_screening_results(db: Session, company_id: str) -> list[ScreeningResult]:
    return list(
        db.query(ScreeningResult)
        .filter(ScreeningResult.company_id == company_id)
        .order_by(ScreeningResult.created_at.desc())
        .all()
    )


# --- Companies (Phase 7) ---------------------------------------------------


def create_company(
    db: Session,
    *,
    name: str,
    industry: str | None = None,
    website: str | None = None,
    description: str | None = None,
    logo_url: str | None = None,
) -> Company:
    company = Company(
        name=name, industry=industry, website=website, description=description, logo_url=logo_url
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def get_company(db: Session, company_id: str) -> Company | None:
    return db.get(Company, company_id)


def update_company(db: Session, company: Company, **fields) -> Company:
    for key, value in fields.items():
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


# --- Users (Phase 7) ---------------------------------------------------


def create_user(
    db: Session,
    *,
    company_id: str,
    email: str,
    password_hash: str,
    first_name: str,
    last_name: str,
    role: UserRole,
) -> User:
    user = User(
        company_id=company_id,
        email=email,
        password_hash=password_hash,
        first_name=first_name,
        last_name=last_name,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: str) -> User | None:
    if not user_id:
        return None
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def list_company_users(db: Session, company_id: str) -> list[User]:
    return list(
        db.query(User).filter(User.company_id == company_id).order_by(User.created_at.asc()).all()
    )


def update_user(db: Session, user: User, **fields) -> User:
    for key, value in fields.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def count_active_admins(db: Session, company_id: str) -> int:
    return (
        db.query(func.count(User.id))
        .filter(User.company_id == company_id, User.role == UserRole.ADMIN, User.is_active.is_(True))
        .scalar()
        or 0
    )


# --- Refresh tokens (Phase 7) -----------------------------------------------


def create_refresh_token_record(db: Session, **fields) -> RefreshToken:
    token = RefreshToken(**fields)
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def get_refresh_token(db: Session, token_id: str) -> RefreshToken | None:
    if not token_id:
        return None
    return db.get(RefreshToken, token_id)


def revoke_refresh_token(db: Session, token: RefreshToken) -> None:
    token.revoked = True
    db.commit()
