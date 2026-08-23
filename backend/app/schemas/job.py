"""Pydantic schemas for the job-description domain."""

from pydantic import BaseModel, Field


class JobProfile(BaseModel):
    """The structured extraction output for a job description."""

    title: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    minimum_experience_months: int | None = None
    education_requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)


class JobCreateRequest(BaseModel):
    description: str = Field(..., min_length=20, description="Raw job description text.")
    title_hint: str | None = Field(
        default=None, description="Optional title if the caller already knows it."
    )


class JobCreateResponse(BaseModel):
    job_id: str
    status: str


class JobResponse(BaseModel):
    job_id: str
    title: str | None
    profile: JobProfile
    created_at: str
