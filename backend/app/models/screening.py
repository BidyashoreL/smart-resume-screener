"""SQLAlchemy model for a persisted screening (match) result."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _new_screening_id() -> str:
    return f"screening_{uuid.uuid4().hex[:10]}"


class ScreeningResult(Base):
    """
    One row = one candidate scored against one job, as part of a screening
    batch (`batch_id` groups the candidates screened together in a single
    `POST /api/screen` call so the API can return them as one ranked list).
    """

    __tablename__ = "screening_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_screening_id)
    batch_id: Mapped[str] = mapped_column(String, index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)

    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), index=True)

    overall_score: Mapped[float] = mapped_column(Float)
    skill_score: Mapped[float] = mapped_column(Float)
    experience_score: Mapped[float] = mapped_column(Float)
    responsibility_score: Mapped[float] = mapped_column(Float)
    education_score: Mapped[float] = mapped_column(Float)

    matched_required_skills: Mapped[list] = mapped_column(JSON)
    missing_required_skills: Mapped[list] = mapped_column(JSON)
    matched_preferred_skills: Mapped[list] = mapped_column(JSON)
    missing_preferred_skills: Mapped[list] = mapped_column(JSON)

    strengths: Mapped[list] = mapped_column(JSON)
    weaknesses: Mapped[list] = mapped_column(JSON)
    justification: Mapped[str] = mapped_column(Text)

    match_band: Mapped[str] = mapped_column(String)  # Strong / Good / Partial / Low
    recommendation: Mapped[str] = mapped_column(String)  # SHORTLIST / CONSIDER / REJECT

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
