"""Job description creation / retrieval endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
def ping() -> dict:
    return {"router": "jobs", "status": "ok"}
