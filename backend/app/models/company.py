"""SQLAlchemy model for a company/organization (tenant)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _new_company_id() -> str:
    return f"company_{uuid.uuid4().hex[:10]}"


class Company(Base):
    """
    A tenant. Every recruiting record (candidate/job/screening result) and
    every user belongs to exactly one company. The backend always derives
    which company_id to use from the authenticated user (see
    `app/core/deps.py`) - it is never accepted from client-supplied input.
    """

    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_company_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
