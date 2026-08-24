"""SQLAlchemy model for a stored candidate (resume)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _new_candidate_id() -> str:
    return f"candidate_{uuid.uuid4().hex[:10]}"


class Candidate(Base):
    """
    A candidate's resume, stored once and re-usable across multiple job
    screenings. Extraction (`structured_json`) is cached here so the same
    resume is never re-sent to the LLM just because it's being screened
    against a different job.

    Scoped to a company (tenant) - see `app/models/company.py`. Every
    repository/route access must filter on `company_id` derived from the
    authenticated user, never from client input.
    """

    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_candidate_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)

    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    structured_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
