"""
Pydantic schemas for the candidate (resume) domain.

`CandidateProfile` is the structured JSON shape the LLM extraction service
must return and that gets validated + persisted. The guiding rule (per the
project spec) is: **never invent candidate facts** - every field is optional
or defaults to null/empty rather than being guessed.
"""

from pydantic import BaseModel, Field


class Skill(BaseModel):
    name: str
    category: str | None = Field(
        default=None, description="e.g. 'programming', 'cloud', 'database', 'soft-skill'"
    )
    evidence: str | None = Field(
        default=None, description="Short quote/paraphrase from the resume supporting this skill"
    )


class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration_months: int | None = Field(
        default=None, description="Null if dates could not be determined - never guessed."
    )
    description: str | None = None


class Education(BaseModel):
    degree: str | None = None
    field: str | None = None
    institution: str | None = None
    graduation_year: int | None = None


class Project(BaseModel):
    name: str | None = None
    description: str | None = None


class CandidateProfile(BaseModel):
    """The structured extraction output for a single resume."""

    name: str | None = None
    email: str | None = None
    phone: str | None = None

    skills: list[Skill] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)

    total_experience_months: int | None = Field(
        default=None, description="Sum of experience durations where known."
    )


class CandidateResponse(BaseModel):
    """What the API returns for a stored candidate."""

    candidate_id: str
    name: str | None
    email: str | None
    profile: CandidateProfile
    created_at: str


class ResumeUploadResponse(BaseModel):
    candidate_id: str
    status: str
    name: str | None = None
    warnings: list[str] = Field(default_factory=list)
