"""SQLAlchemy model for a stored job description."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _new_job_id() -> str:
    return f"job_{uuid.uuid4().hex[:10]}"


class Job(Base):
    """Scoped to a company (tenant) - see `app/models/company.py`."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_job_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)

    raw_description: Mapped[str] = mapped_column(Text, nullable=False)
    structured_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
