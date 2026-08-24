"""
Lightweight, additive-only schema migration for SQLite.

This project deliberately uses `Base.metadata.create_all()` instead of
Alembic (see `database.py`) - `create_all()` only creates tables that don't
exist yet, it never alters existing ones. Phase 7 adds `company_id` to three
tables (`candidates`, `jobs`, `screening_results`) that may already have
rows in a pre-existing `resume_screener.db` from before multi-tenant
support existed. A plain model change alone would leave those already-created
SQLite tables without the new column, so this module is a deliberately
narrow, idempotent substitute for a real migration tool:

  1. Ensure a default "demo" company exists (id is a fixed constant, so this
     is safe to run on every startup).
  2. For each of the three tables, if it already exists but lacks
     `company_id`, add the column via `ALTER TABLE ... ADD COLUMN` and
     backfill every existing (NULL) row with the demo company's id.

No row is ever deleted, and a brand-new database is unaffected (`create_all()`
already creates those tables with `company_id NOT NULL` from the model
definitions, so every branch below is a no-op).

Known limitation: SQLite's `ALTER TABLE ... ADD COLUMN` cannot add a `NOT
NULL` constraint to a column on a table that already has rows unless a
constant default is supplied at the SQL level. We add the column as
nullable and then backfill it via `UPDATE`, so existing rows end up with a
non-null value, but the column itself is not enforced NOT NULL at the SQLite
schema level for tables that went through this migration path (it is
enforced for tables created fresh from the model). This is an accepted
trade-off of not introducing Alembic for local SQLite development; a real
production deployment on Postgres should use a proper migration tool.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.logging import get_logger

logger = get_logger(__name__)

DEMO_COMPANY_ID = "company_demo_default"
DEMO_COMPANY_NAME = "Demo Organization"

_TABLES_NEEDING_COMPANY_ID = ("candidates", "jobs", "screening_results")


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return row is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return any(row[1] == column_name for row in rows)


def _ensure_demo_company(conn) -> None:
    if not _table_exists(conn, "companies"):
        return  # create_all() hasn't run yet - nothing to backfill into
    existing = conn.execute(
        text("SELECT id FROM companies WHERE id = :id"), {"id": DEMO_COMPANY_ID}
    ).fetchone()
    if existing is not None:
        return
    logger.info("Creating default demo company to own pre-existing single-tenant data")
    conn.execute(
        text(
            "INSERT INTO companies (id, name, industry, website, description, logo_url, "
            "created_at, updated_at) "
            "VALUES (:id, :name, NULL, NULL, :description, NULL, "
            "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ),
        {
            "id": DEMO_COMPANY_ID,
            "name": DEMO_COMPANY_NAME,
            "description": (
                "Automatically created to own candidates, jobs, and screening "
                "results that were created before multi-tenant support was added."
            ),
        },
    )


def run_migrations(engine: Engine) -> None:
    """Idempotent, additive-only. Safe to call on every application startup."""
    if engine.dialect.name != "sqlite":
        # This project only targets SQLite for local development; a hosted
        # deployment on a different engine should use a real migration tool.
        return

    with engine.begin() as conn:
        _ensure_demo_company(conn)

        for table in _TABLES_NEEDING_COMPANY_ID:
            if not _table_exists(conn, table):
                continue  # fresh DB - create_all() already created it with company_id
            if _column_exists(conn, table, "company_id"):
                continue

            logger.info("Migrating table '%s': adding company_id column", table)
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN company_id VARCHAR"))
            conn.execute(
                text(f"UPDATE {table} SET company_id = :company_id WHERE company_id IS NULL"),
                {"company_id": DEMO_COMPANY_ID},
            )
