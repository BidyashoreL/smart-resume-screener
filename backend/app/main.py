"""
FastAPI application entrypoint.

This module wires together configuration, logging, the database, exception
handling, and the API routers. It intentionally contains no business logic -
that all lives in `app/services/`.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import routes_resumes, routes_jobs, routes_screening
from app.core.config import get_settings
from app.core.exceptions import ResumeScreenerError
from app.core.logging import configure_logging, get_logger
from app.db.database import init_db

settings = get_settings()
configure_logging()
logger = get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    description=(
        "Structured, evidence-backed resume screening: extracts candidate and "
        "job information, runs hybrid deterministic + LLM matching, and returns "
        "a ranked, explainable shortlist."
    ),
    version="1.0.0",
)

# Streamlit (or any local frontend) runs on a different port during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ResumeScreenerError)
async def handle_application_error(request: Request, exc: ResumeScreenerError) -> JSONResponse:
    """
    Translate every known application error into a consistent JSON body
    without leaking internals (stack traces, API keys, SQL, etc.) to the client.
    """
    if exc.status_code >= 500:
        logger.exception("Unhandled application error", exc_info=exc)
    else:
        logger.warning("%s: %s", exc.__class__.__name__, exc.message)

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "detail": exc.message},
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unexpected error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"error": "InternalServerError", "detail": "An unexpected error occurred."},
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info("%s started (provider=%s, env=%s)", settings.app_name, settings.llm_provider, settings.environment)


@app.get("/health", tags=["system"])
def health_check() -> dict:
    return {"status": "ok", "service": settings.app_name}


app.include_router(routes_resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(routes_jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(routes_screening.router, prefix="/api/screen", tags=["screening"])
