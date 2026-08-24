"""
Resume upload / retrieval endpoints.

Routes stay thin: they validate the HTTP-level shape of the request, call
into services, and shape the response. Extraction and persistence logic
live in `document_service`, `extraction_service`, and `db/repositories`.
"""

from datetime import timezone

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.logging import get_logger
from app.db import repositories
from app.db.database import get_db
from app.models.user import User
from app.schemas.candidate import CandidateProfile, CandidateResponse, ResumeUploadResponse
from app.services import document_service
from app.services.extraction_service import ExtractionService, get_extraction_service

router = APIRouter()
logger = get_logger(__name__)


@router.post("/upload", response_model=ResumeUploadResponse, status_code=201)
async def upload_resume(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    extraction_service: ExtractionService = Depends(get_extraction_service),
) -> ResumeUploadResponse:
    """
    Accepts a PDF or TXT resume, extracts text, runs LLM-based structured
    extraction, and persists the resulting candidate profile so it can be
    reused across multiple future screenings without re-processing. The
    candidate is owned by the authenticated user's company.
    """
    file_bytes = await file.read()
    extracted = document_service.validate_and_extract(file.filename or "resume", file_bytes)

    profile: CandidateProfile = extraction_service.extract_candidate_profile(extracted.raw_text)

    candidate = repositories.create_candidate(
        db,
        company_id=current_user.company_id,
        name=profile.name,
        email=profile.email,
        phone=profile.phone,
        raw_text=extracted.raw_text,
        structured_json=profile.model_dump(),
        file_path=None,  # not persisting the original binary in this implementation
        original_filename=extracted.original_filename,
    )

    logger.info("Processed resume upload -> candidate_id=%s company=%s", candidate.id, current_user.company_id)

    return ResumeUploadResponse(candidate_id=candidate.id, status="processed", name=candidate.name)


@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_resume(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CandidateResponse:
    candidate = repositories.get_candidate(db, candidate_id, current_user.company_id)
    return CandidateResponse(
        candidate_id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        profile=CandidateProfile.model_validate(candidate.structured_json),
        created_at=candidate.created_at.replace(tzinfo=timezone.utc).isoformat(),
    )


@router.get("", response_model=list[CandidateResponse])
def list_resumes(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[CandidateResponse]:
    candidates = repositories.list_candidates(db, current_user.company_id)
    return [
        CandidateResponse(
            candidate_id=c.id,
            name=c.name,
            email=c.email,
            profile=CandidateProfile.model_validate(c.structured_json),
            created_at=c.created_at.replace(tzinfo=timezone.utc).isoformat(),
        )
        for c in candidates
    ]
