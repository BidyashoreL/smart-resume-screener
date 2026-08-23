"""Resume upload / retrieval endpoints. Business logic lives in services."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
def ping() -> dict:
    return {"router": "resumes", "status": "ok"}
