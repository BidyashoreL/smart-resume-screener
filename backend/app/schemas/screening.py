"""
Pydantic schemas for the matching / scoring / screening domain.

`LLMMatchAnalysis` is the structured shape returned by the semantic matching
prompt (see `app/prompts/candidate_matching.txt`) - the LLM never returns a
bare number, it returns evidence that the deterministic scorer and the API
response both build on.
"""

from typing import Literal

from pydantic import BaseModel, Field


class RelevantExperienceEvidence(BaseModel):
    evidence: str
    relevance: Literal["high", "medium", "low"] = "medium"


class LLMMatchAnalysis(BaseModel):
    """Structured output of the LLM semantic matching step."""

    matched_required_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    matched_preferred_skills: list[str] = Field(default_factory=list)
    missing_preferred_skills: list[str] = Field(default_factory=list)

    relevant_experience: list[RelevantExperienceEvidence] = Field(default_factory=list)

    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    semantic_fit_score: float = Field(
        default=5.0, ge=0, le=10, description="LLM's own 0-10 semantic fit estimate."
    )
    justification: str = ""


class SkillEvidence(BaseModel):
    """One row of the evidence table shown to the recruiter (section 15 of the spec)."""

    skill: str
    required: bool
    matched: bool
    source: str | None = Field(
        default=None, description="Where the match came from, e.g. 'candidate skills', 'project'"
    )


class ScoreBreakdown(BaseModel):
    skill_score: float
    experience_score: float
    responsibility_score: float
    education_score: float
    overall_score: float = Field(..., description="Weighted 0-100 score.")

    @property
    def overall_score_out_of_10(self) -> float:
        return round(self.overall_score / 10, 1)


class CandidateScreeningResult(BaseModel):
    candidate_id: str
    candidate_name: str | None
    scores: ScoreBreakdown
    match_band: Literal["Strong Match", "Good Match", "Partial Match", "Low Match"]
    recommendation: Literal["SHORTLIST", "CONSIDER", "REJECT"]

    matched_required_skills: list[str]
    missing_required_skills: list[str]
    matched_preferred_skills: list[str]
    missing_preferred_skills: list[str]
    skill_evidence: list[SkillEvidence]

    strengths: list[str]
    weaknesses: list[str]
    justification: str


class ScreeningRequest(BaseModel):
    job_id: str
    candidate_ids: list[str] = Field(..., min_length=1)


class ScreeningResponse(BaseModel):
    screening_id: str
    job_id: str
    results: list[CandidateScreeningResult]
