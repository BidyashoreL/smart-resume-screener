"""
Screening endpoints: run hybrid matching for a batch of candidates against
a job, persist every result, rank them, and return the ranked list. Also
exposes retrieval of a previously-run screening batch by id.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db import repositories
from app.db.database import get_db
from app.schemas.candidate import CandidateProfile
from app.schemas.job import JobProfile
from app.schemas.screening import (
    CandidateScreeningResult,
    ScoreBreakdown,
    ScreeningRequest,
    ScreeningResponse,
    SkillEvidence,
)
from app.services.matching_service import MatchingService, get_matching_service
from app.services.ranking_service import rank_candidates

router = APIRouter()
logger = get_logger(__name__)


@router.post("", response_model=ScreeningResponse)
def screen_candidates(
    payload: ScreeningRequest,
    db: Session = Depends(get_db),
    matching_service: MatchingService = Depends(get_matching_service),
) -> ScreeningResponse:
    job_row = repositories.get_job(db, payload.job_id)
    job_profile = JobProfile.model_validate(job_row.structured_json)

    batch_id = f"screening_{uuid.uuid4().hex[:10]}"
    results: list[CandidateScreeningResult] = []

    for candidate_id in payload.candidate_ids:
        candidate_row = repositories.get_candidate(db, candidate_id)
        candidate_profile = CandidateProfile.model_validate(candidate_row.structured_json)

        match_result = matching_service.match(candidate_profile, job_profile)

        repositories.create_screening_result(
            db,
            id=f"screening_{uuid.uuid4().hex[:10]}",
            batch_id=batch_id,
            candidate_id=candidate_id,
            job_id=payload.job_id,
            overall_score=match_result.scores.overall_score,
            skill_score=match_result.scores.skill_score,
            experience_score=match_result.scores.experience_score,
            responsibility_score=match_result.scores.responsibility_score,
            education_score=match_result.scores.education_score,
            matched_required_skills=match_result.matched_required_skills,
            missing_required_skills=match_result.missing_required_skills,
            matched_preferred_skills=match_result.matched_preferred_skills,
            missing_preferred_skills=match_result.missing_preferred_skills,
            strengths=match_result.strengths,
            weaknesses=match_result.weaknesses,
            justification=match_result.justification,
            match_band=match_result.match_band,
            recommendation=match_result.recommendation,
        )

        results.append(
            CandidateScreeningResult(
                candidate_id=candidate_id,
                candidate_name=candidate_row.name,
                scores=match_result.scores,
                match_band=match_result.match_band,
                recommendation=match_result.recommendation,
                matched_required_skills=match_result.matched_required_skills,
                missing_required_skills=match_result.missing_required_skills,
                matched_preferred_skills=match_result.matched_preferred_skills,
                missing_preferred_skills=match_result.missing_preferred_skills,
                skill_evidence=match_result.skill_evidence,
                strengths=match_result.strengths,
                weaknesses=match_result.weaknesses,
                justification=match_result.justification,
            )
        )

    ranked_results = rank_candidates(results)
    logger.info(
        "Screening batch %s: %d candidates screened against job %s",
        batch_id,
        len(ranked_results),
        payload.job_id,
    )

    return ScreeningResponse(screening_id=batch_id, job_id=payload.job_id, results=ranked_results)


@router.get("/{screening_id}", response_model=ScreeningResponse)
def get_screening(screening_id: str, db: Session = Depends(get_db)) -> ScreeningResponse:
    rows = repositories.get_screening_batch(db, screening_id)
    job_id = rows[0].job_id

    results = [
        CandidateScreeningResult(
            candidate_id=row.candidate_id,
            candidate_name=None,
            scores=ScoreBreakdown(
                skill_score=row.skill_score,
                experience_score=row.experience_score,
                responsibility_score=row.responsibility_score,
                education_score=row.education_score,
                overall_score=row.overall_score,
            ),
            match_band=row.match_band,
            recommendation=row.recommendation,
            matched_required_skills=row.matched_required_skills,
            missing_required_skills=row.missing_required_skills,
            matched_preferred_skills=row.matched_preferred_skills,
            missing_preferred_skills=row.missing_preferred_skills,
            skill_evidence=[
                SkillEvidence(skill=s, required=True, matched=True, source="candidate profile")
                for s in row.matched_required_skills
            ]
            + [
                SkillEvidence(skill=s, required=True, matched=False, source=None)
                for s in row.missing_required_skills
            ]
            + [
                SkillEvidence(skill=s, required=False, matched=True, source="candidate profile")
                for s in row.matched_preferred_skills
            ]
            + [
                SkillEvidence(skill=s, required=False, matched=False, source=None)
                for s in row.missing_preferred_skills
            ],
            strengths=row.strengths,
            weaknesses=row.weaknesses,
            justification=row.justification,
        )
        for row in rows
    ]

    return ScreeningResponse(
        screening_id=screening_id, job_id=job_id, results=rank_candidates(results)
    )
