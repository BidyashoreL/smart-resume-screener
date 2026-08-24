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
from collections import Counter
from app.schemas.screening import (
    AnalyticsOverview,
    CandidateScreeningResult,
    JobPerformanceItem,
    ScoreBreakdown,
    ScreeningBatchSummary,
    ScreeningRequest,
    ScreeningResponse,
    SkillEvidence,
    SkillInsightItem,
    TopCandidateItem,
)
from app.services.matching_service import MatchingService, get_matching_service
from app.services.ranking_service import rank_candidates

router = APIRouter()
logger = get_logger(__name__)


@router.get("/analytics/overview", response_model=AnalyticsOverview)
def get_analytics_overview(db: Session = Depends(get_db)) -> AnalyticsOverview:
    candidates = repositories.list_candidates(db)
    jobs = repositories.list_jobs(db)
    all_results = repositories.list_all_screening_results(db)

    jobs_map = {j.id: (j.title or (j.structured_json.get("title") if isinstance(j.structured_json, dict) else None) or "Untitled Job") for j in jobs}
    candidates_map = {c.id: (c.name or (c.structured_json.get("name") if isinstance(c.structured_json, dict) else None) or "Candidate") for c in candidates}

    # Group by batch_id
    batches_dict: dict[str, list] = {}
    for r in all_results:
        batches_dict.setdefault(r.batch_id, []).append(r)

    recent_screenings: list[ScreeningBatchSummary] = []
    for b_id, rows in batches_dict.items():
        first_row = rows[0]
        c_count = len(rows)
        s_count = sum(1 for x in rows if x.recommendation == "SHORTLIST")
        con_count = sum(1 for x in rows if x.recommendation == "CONSIDER")
        rej_count = sum(1 for x in rows if x.recommendation == "REJECT")
        avg_sc = round(sum(x.overall_score for x in rows) / c_count, 1) if c_count > 0 else 0.0

        recent_screenings.append(
            ScreeningBatchSummary(
                screening_id=b_id,
                job_id=first_row.job_id,
                job_title=jobs_map.get(first_row.job_id, first_row.job_id),
                candidates_count=c_count,
                shortlist_count=s_count,
                consider_count=con_count,
                reject_count=rej_count,
                average_score=avg_sc,
                created_at=first_row.created_at.isoformat() if first_row.created_at else "",
            )
        )

    # Sort recent screenings chronologically (newest first)
    recent_screenings.sort(key=lambda x: x.created_at, reverse=True)

    # Global stats
    total_screened = len(all_results)
    shortlisted_total = sum(1 for x in all_results if x.recommendation == "SHORTLIST")
    consider_total = sum(1 for x in all_results if x.recommendation == "CONSIDER")
    rejected_total = sum(1 for x in all_results if x.recommendation == "REJECT")
    avg_score_total = round(sum(x.overall_score for x in all_results) / total_screened, 1) if total_screened > 0 else 0.0

    match_band_dist = {
        "Strong Match": sum(1 for x in all_results if x.match_band == "Strong Match"),
        "Good Match": sum(1 for x in all_results if x.match_band == "Good Match"),
        "Partial Match": sum(1 for x in all_results if x.match_band == "Partial Match"),
        "Low Match": sum(1 for x in all_results if x.match_band == "Low Match"),
    }

    rec_dist = {
        "SHORTLIST": shortlisted_total,
        "CONSIDER": consider_total,
        "REJECT": rejected_total,
    }

    # Top candidates by overall score
    sorted_results = sorted(all_results, key=lambda x: x.overall_score, reverse=True)
    top_candidates: list[TopCandidateItem] = []
    seen_cands = set()
    for row in sorted_results:
        if row.candidate_id not in seen_cands and len(top_candidates) < 6:
            seen_cands.add(row.candidate_id)
            top_candidates.append(
                TopCandidateItem(
                    candidate_id=row.candidate_id,
                    candidate_name=candidates_map.get(row.candidate_id, row.candidate_id),
                    job_id=row.job_id,
                    job_title=jobs_map.get(row.job_id, row.job_id),
                    overall_score=row.overall_score,
                    match_band=row.match_band,
                    recommendation=row.recommendation,
                    strengths=row.strengths if isinstance(row.strengths, list) else [],
                    screening_id=row.batch_id,
                )
            )

    # Job performance breakdown
    job_perf: list[JobPerformanceItem] = []
    for job in jobs:
        j_rows = [r for r in all_results if r.job_id == job.id]
        j_screened = len(j_rows)
        j_short = sum(1 for x in j_rows if x.recommendation == "SHORTLIST")
        j_cons = sum(1 for x in j_rows if x.recommendation == "CONSIDER")
        j_rej = sum(1 for x in j_rows if x.recommendation == "REJECT")
        j_avg = round(sum(x.overall_score for x in j_rows) / j_screened, 1) if j_screened > 0 else 0.0

        job_perf.append(
            JobPerformanceItem(
                job_id=job.id,
                job_title=jobs_map.get(job.id, job.id),
                candidates_screened=j_screened,
                shortlist_count=j_short,
                consider_count=j_cons,
                reject_count=j_rej,
                average_score=j_avg,
            )
        )

    # Skills insights
    matched_req_counter = Counter()
    missing_req_counter = Counter()
    matched_pref_counter = Counter()

    for r in all_results:
        if isinstance(r.matched_required_skills, list):
            matched_req_counter.update(r.matched_required_skills)
        if isinstance(r.missing_required_skills, list):
            missing_req_counter.update(r.missing_required_skills)
        if isinstance(r.matched_preferred_skills, list):
            matched_pref_counter.update(r.matched_preferred_skills)

    return AnalyticsOverview(
        total_candidates=len(candidates),
        active_jobs=len(jobs),
        total_screenings=len(batches_dict),
        candidates_screened=total_screened,
        shortlisted_count=shortlisted_total,
        consider_count=consider_total,
        rejected_count=rejected_total,
        average_score=avg_score_total,
        match_band_distribution=match_band_dist,
        recommendation_distribution=rec_dist,
        recent_screenings=recent_screenings,
        top_candidates=top_candidates,
        job_performance=job_perf,
        frequently_matched_required_skills=[
            SkillInsightItem(skill=s, count=c) for s, c in matched_req_counter.most_common(8)
        ],
        frequently_missing_required_skills=[
            SkillInsightItem(skill=s, count=c) for s, c in missing_req_counter.most_common(8)
        ],
        frequently_matched_preferred_skills=[
            SkillInsightItem(skill=s, count=c) for s, c in matched_pref_counter.most_common(8)
        ],
    )


@router.get("/batches", response_model=list[ScreeningBatchSummary])
def list_screening_batches(db: Session = Depends(get_db)) -> list[ScreeningBatchSummary]:
    overview = get_analytics_overview(db)
    return overview.recent_screenings


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
