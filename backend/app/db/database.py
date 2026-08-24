"""
SQLAlchemy engine/session setup.

Uses SQLite for local development and demos, as specified in the project
plan. The code avoids SQLite-specific assumptions elsewhere (models use
portable column types) so swapping `DATABASE_URL` for a PostgreSQL URL is
the only change needed to move to Postgres later.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create all tables that don't already exist, then run the additive-only
    company_id backfill migration. Called on app startup."""
    # Import models here (not at module top-level) so they register on Base.metadata
    # before create_all runs, without creating a circular import at module load time.
    from app.models import candidate, company, job, refresh_token, screening, user  # noqa: F401

    Base.metadata.create_all(bind=engine)

    from app.db.migrations import run_migrations

    run_migrations(engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
