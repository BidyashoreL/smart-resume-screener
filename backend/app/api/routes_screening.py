"""Screening (matching + ranking) endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
def ping() -> dict:
    return {"router": "screening", "status": "ok"}
