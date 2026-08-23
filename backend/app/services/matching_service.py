"""
Hybrid matching engine (section 10-11 of the spec).

    Candidate Profile ---+
                          |--> Matching Engine --> Deterministic Score
    Job Profile ----------+                    --> LLM Semantic Analysis
                                                --> Final Explanation

Deliberately NOT built as `resume + JD -> LLM -> "87"`. Instead:

  1. Compute a deterministic skill overlap using normalized skill sets
     (`normalization_service`) - this alone catches most matches/misses
     and is 100% reproducible.
  2. Ask the LLM for a semantic analysis (catches equivalences the
     normalization alias table doesn't know about, and provides
     experience-relevance + responsibility-alignment judgments that are
     inherently semantic).
  3. Reconcile the two: an LLM-claimed match is only trusted if the skill
     it names is actually a requirement of the job AND is traceable to
     something in the candidate's own profile (skills, evidence, project
     or experience descriptions). This stops the LLM from silently
     inventing a qualification (section 17's "LLM should not be trusted
     for" list).
  4. Hand the reconciled evidence to `scoring_service` for the final
     numeric score.
"""

from app.core.exceptions import LLMProviderError
from app.core.logging import get_logger
from app.schemas.candidate import CandidateProfile
from app.schemas.job import JobProfile
from app.schemas.screening import LLMMatchAnalysis, SkillEvidence
from app.services import scoring_service
from app.services.llm_service import LLMService, get_llm_service
from app.services.normalization_service import normalize_skill

logger = get_logger(__name__)


def _candidate_evidence_text(candidate: CandidateProfile) -> str:
    """All free-text a skill claim could plausibly be grounded in."""
    parts: list[str] = []
    for skill in candidate.skills:
        parts.append(skill.name)
        if skill.evidence:
            parts.append(skill.evidence)
    for exp in candidate.experience:
        if exp.description:
            parts.append(exp.description)
        if exp.role:
            parts.append(exp.role)
    for proj in candidate.projects:
        if proj.description:
            parts.append(proj.description)
        if proj.name:
            parts.append(proj.name)
    return " | ".join(parts).lower()


def _reconcile(
    job_required: list[str],
    job_preferred: list[str],
    candidate: CandidateProfile,
    llm_analysis: LLMMatchAnalysis,
) -> tuple[list[str], list[str], list[str], list[str]]:
    """
    Merge deterministic normalization-based matching with the LLM's claims,
    guarding against LLM-invented matches. Returns
    (matched_required, missing_required, matched_preferred, missing_preferred),
    each a list of skill names using the job description's own original casing.
    """
    candidate_normalized = {normalize_skill(s.name) for s in candidate.skills}
    evidence_text = _candidate_evidence_text(candidate)

    llm_matched_required_norm = {normalize_skill(s) for s in llm_analysis.matched_required_skills}
    llm_matched_preferred_norm = {
        normalize_skill(s) for s in llm_analysis.matched_preferred_skills
    }

    def resolve(job_skills: list[str], llm_matched_norm: set[str]) -> tuple[list[str], list[str]]:
        matched, missing = [], []
        for skill in job_skills:
            norm = normalize_skill(skill)
            deterministic_hit = norm in candidate_normalized
            # Only trust an LLM-only match if the (normalized) skill text is
            # actually grounded somewhere in the candidate's own evidence text -
            # this is the anti-hallucination guard.
            llm_hit = norm in llm_matched_norm and (
                deterministic_hit or norm in evidence_text or skill.lower() in evidence_text
            )
            if deterministic_hit or llm_hit:
                matched.append(skill)
            else:
                missing.append(skill)
        return matched, missing

    matched_required, missing_required = resolve(job_required, llm_matched_required_norm)
    matched_preferred, missing_preferred = resolve(job_preferred, llm_matched_preferred_norm)
    return matched_required, missing_required, matched_preferred, missing_preferred


def _build_skill_evidence(
    matched_required: list[str],
    missing_required: list[str],
    matched_preferred: list[str],
    missing_preferred: list[str],
) -> list[SkillEvidence]:
    evidence = []
    for skill in matched_required:
        evidence.append(
            SkillEvidence(skill=skill, required=True, matched=True, source="candidate profile")
        )
    for skill in missing_required:
        evidence.append(SkillEvidence(skill=skill, required=True, matched=False, source=None))
    for skill in matched_preferred:
        evidence.append(
            SkillEvidence(skill=skill, required=False, matched=True, source="candidate profile")
        )
    for skill in missing_preferred:
        evidence.append(SkillEvidence(skill=skill, required=False, matched=False, source=None))
    return evidence


class MatchResult:
    """Everything needed to build the API response and persist a screening row."""

    def __init__(
        self,
        scores,
        match_band: str,
        recommendation: str,
        matched_required_skills: list[str],
        missing_required_skills: list[str],
        matched_preferred_skills: list[str],
        missing_preferred_skills: list[str],
        skill_evidence: list[SkillEvidence],
        strengths: list[str],
        weaknesses: list[str],
        justification: str,
    ) -> None:
        self.scores = scores
        self.match_band = match_band
        self.recommendation = recommendation
        self.matched_required_skills = matched_required_skills
        self.missing_required_skills = missing_required_skills
        self.matched_preferred_skills = matched_preferred_skills
        self.missing_preferred_skills = missing_preferred_skills
        self.skill_evidence = skill_evidence
        self.strengths = strengths
        self.weaknesses = weaknesses
        self.justification = justification


class MatchingService:
    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service or get_llm_service()

    def match(self, candidate: CandidateProfile, job: JobProfile) -> MatchResult:
        candidate_json = candidate.model_dump()
        job_json = job.model_dump()

        try:
            raw_analysis = self._llm_service.match_candidate(candidate_json, job_json)
            llm_analysis = LLMMatchAnalysis.model_validate(raw_analysis)
        except LLMProviderError:
            raise
        except Exception as exc:  # schema validation failure on an otherwise-valid JSON response
            logger.error("LLM match analysis failed schema validation: %s", exc)
            raise LLMProviderError(
                "The LLM's matching analysis did not match the expected schema."
            ) from exc

        matched_required, missing_required, matched_preferred, missing_preferred = _reconcile(
            job.required_skills, job.preferred_skills, candidate, llm_analysis
        )

        scores = scoring_service.build_score_breakdown(
            candidate=candidate,
            job=job,
            llm_analysis=llm_analysis,
            matched_required=matched_required,
            missing_required=missing_required,
            matched_preferred=matched_preferred,
            missing_preferred=missing_preferred,
        )
        match_band = scoring_service.determine_match_band(scores.overall_score)
        recommendation = scoring_service.determine_recommendation(match_band)

        skill_evidence = _build_skill_evidence(
            matched_required, missing_required, matched_preferred, missing_preferred
        )

        return MatchResult(
            scores=scores,
            match_band=match_band,
            recommendation=recommendation,
            matched_required_skills=matched_required,
            missing_required_skills=missing_required,
            matched_preferred_skills=matched_preferred,
            missing_preferred_skills=missing_preferred,
            skill_evidence=skill_evidence,
            strengths=llm_analysis.strengths,
            weaknesses=llm_analysis.weaknesses,
            justification=llm_analysis.justification,
        )


_matching_service_singleton: MatchingService | None = None


def get_matching_service() -> MatchingService:
    global _matching_service_singleton
    if _matching_service_singleton is None:
        _matching_service_singleton = MatchingService()
    return _matching_service_singleton
