"""Job description creation / retrieval endpoints."""

from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db import repositories
from app.db.database import get_db
from app.schemas.job import JobCreateRequest, JobCreateResponse, JobProfile, JobResponse
from app.services import job_parser
from app.services.extraction_service import ExtractionService, get_extraction_service

router = APIRouter()
logger = get_logger(__name__)


@router.post("", response_model=JobCreateResponse, status_code=201)
def create_job(
    payload: JobCreateRequest,
    db: Session = Depends(get_db),
    extraction_service: ExtractionService = Depends(get_extraction_service),
) -> JobCreateResponse:
    cleaned_description = job_parser.parse_job_description(payload.description)
    profile: JobProfile = extraction_service.extract_job_profile(cleaned_description)

    if payload.title_hint and not profile.title:
        profile.title = payload.title_hint

    job = repositories.create_job(
        db,
        title=profile.title,
        raw_description=cleaned_description,
        structured_json=profile.model_dump(),
    )

    logger.info("Created job -> job_id=%s title=%r", job.id, job.title)
    return JobCreateResponse(job_id=job.id, status="created")


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobResponse:
    job = repositories.get_job(db, job_id)
    return JobResponse(
        job_id=job.id,
        title=job.title,
        profile=JobProfile.model_validate(job.structured_json),
        created_at=job.created_at.replace(tzinfo=timezone.utc).isoformat(),
    )


@router.get("", response_model=list[JobResponse])
def list_jobs(db: Session = Depends(get_db)) -> list[JobResponse]:
    jobs = repositories.list_jobs(db)
    return [
        JobResponse(
            job_id=j.id,
            title=j.title,
            profile=JobProfile.model_validate(j.structured_json),
            created_at=j.created_at.replace(tzinfo=timezone.utc).isoformat(),
        )
        for j in jobs
    ]
