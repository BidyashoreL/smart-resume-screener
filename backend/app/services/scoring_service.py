"""
Deterministic scoring engine.

Implements the weighted scoring model from the project spec (section 12):

    Required Skills       45%
    Relevant Experience    30%
    Responsibilities       15%
    Education              10%

Every function here is a pure function of already-computed inputs (matched/
missing skill lists, candidate/job profiles, LLM analysis) - no LLM or DB
calls happen in this module. That's deliberate: it's what makes the scoring
reproducible and independently unit-testable (see tests/unit/test_scoring.py),
per the plan's "deterministic, reproducible scoring" principle. The LLM's
role is to *supply* some of the inputs (semantic skill matches, experience
relevance, responsibility alignment) - not to compute the final number.

Design decisions not fully pinned down by the spec (documented here and in
the README so they're easy to defend/adjust):

  - Within the 45% "skill" weight, required-skill coverage counts for 85%
    of that component and preferred-skill coverage for 15%, reflecting
    section 13's rule that a missing required skill is a bigger deal than
    a missing preferred one.
  - The "responsibilities" component is derived from the LLM's holistic
    semantic_fit_score (0-10 -> 0-100), since responsibility alignment is
    inherently a semantic judgment the deterministic layer can't compute
    from structured fields alone.
  - Experience score = (total experience vs. the job's minimum, capped at
    100%) scaled by a relevance multiplier derived from the LLM's
    relevant_experience evidence ratings - this operationalizes the
    "total vs. relevant experience" distinction from section 14.
"""

from app.core.config import Settings, get_settings
from app.schemas.candidate import CandidateProfile
from app.schemas.job import JobProfile
from app.schemas.screening import LLMMatchAnalysis, ScoreBreakdown

_REQUIRED_SKILL_WEIGHT_WITHIN_COMPONENT = 0.85
_PREFERRED_SKILL_WEIGHT_WITHIN_COMPONENT = 0.15

_RELEVANCE_MULTIPLIER = {"high": 1.0, "medium": 0.75, "low": 0.5}
_DEFAULT_RELEVANCE_MULTIPLIER = 0.7  # used when the LLM gave no relevance evidence at all


def compute_skill_score(
    matched_required: list[str],
    missing_required: list[str],
    matched_preferred: list[str],
    missing_preferred: list[str],
) -> float:
    total_required = len(matched_required) + len(missing_required)
    total_preferred = len(matched_preferred) + len(missing_preferred)

    required_pct = (len(matched_required) / total_required * 100) if total_required else 100.0
    preferred_pct = (len(matched_preferred) / total_preferred * 100) if total_preferred else 100.0

    return round(
        _REQUIRED_SKILL_WEIGHT_WITHIN_COMPONENT * required_pct
        + _PREFERRED_SKILL_WEIGHT_WITHIN_COMPONENT * preferred_pct,
        2,
    )


def compute_experience_score(
    candidate: CandidateProfile, job: JobProfile, llm_analysis: LLMMatchAnalysis
) -> float:
    total_months = candidate.total_experience_months or 0
    minimum_months = job.minimum_experience_months

    if not minimum_months or minimum_months <= 0:
        base_pct = 100.0  # job stated no minimum - don't penalize on tenure alone
    else:
        base_pct = min(total_months / minimum_months, 1.0) * 100

    if llm_analysis.relevant_experience:
        multipliers = [
            _RELEVANCE_MULTIPLIER.get(evidence.relevance, _DEFAULT_RELEVANCE_MULTIPLIER)
            for evidence in llm_analysis.relevant_experience
        ]
        relevance_multiplier = sum(multipliers) / len(multipliers)
    else:
        relevance_multiplier = _DEFAULT_RELEVANCE_MULTIPLIER

    return round(min(base_pct * relevance_multiplier, 100.0), 2)


def compute_responsibility_score(llm_analysis: LLMMatchAnalysis) -> float:
    return round(max(0.0, min(llm_analysis.semantic_fit_score, 10.0)) * 10, 2)


def compute_education_score(candidate: CandidateProfile, job: JobProfile) -> float:
    if not job.education_requirements:
        return 100.0

    candidate_edu_text = " ".join(
        f"{edu.degree or ''} {edu.field or ''}" for edu in candidate.education
    ).lower()

    if any(req.lower() in candidate_edu_text for req in job.education_requirements):
        return 100.0
    if candidate.education:
        return 60.0  # has a degree, just not in the required field
    return 0.0


def compute_overall_score(
    skill_score: float,
    experience_score: float,
    responsibility_score: float,
    education_score: float,
    settings: Settings | None = None,
) -> float:
    settings = settings or get_settings()
    overall = (
        settings.weight_required_skills * skill_score
        + settings.weight_experience * experience_score
        + settings.weight_responsibilities * responsibility_score
        + settings.weight_education * education_score
    )
    return round(overall, 2)


def build_score_breakdown(
    candidate: CandidateProfile,
    job: JobProfile,
    llm_analysis: LLMMatchAnalysis,
    matched_required: list[str],
    missing_required: list[str],
    matched_preferred: list[str],
    missing_preferred: list[str],
    settings: Settings | None = None,
) -> ScoreBreakdown:
    settings = settings or get_settings()

    skill_score = compute_skill_score(
        matched_required, missing_required, matched_preferred, missing_preferred
    )
    experience_score = compute_experience_score(candidate, job, llm_analysis)
    responsibility_score = compute_responsibility_score(llm_analysis)
    education_score = compute_education_score(candidate, job)

    overall = compute_overall_score(
        skill_score, experience_score, responsibility_score, education_score, settings
    )

    return ScoreBreakdown(
        skill_score=skill_score,
        experience_score=experience_score,
        responsibility_score=responsibility_score,
        education_score=education_score,
        overall_score=overall,
    )


def determine_match_band(overall_score: float, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if overall_score >= settings.band_strong_match:
        return "Strong Match"
    if overall_score >= settings.band_good_match:
        return "Good Match"
    if overall_score >= settings.band_partial_match:
        return "Partial Match"
    return "Low Match"


def determine_recommendation(match_band: str) -> str:
    if match_band in ("Strong Match", "Good Match"):
        return "SHORTLIST"
    if match_band == "Partial Match":
        return "CONSIDER"
    return "REJECT"
