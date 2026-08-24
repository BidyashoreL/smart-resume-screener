"""Self-service profile endpoints for the currently authenticated user."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db import repositories
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.user import UserProfileUpdate

router = APIRouter()


@router.get("/me", response_model=UserPublic)
def get_my_profile(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
def update_my_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    # `UserProfileUpdate` has no `role`/`company_id` field, so there is no
    # way for a request body to reach those columns through this endpoint -
    # see app/schemas/user.py.
    updates = payload.model_dump(exclude_unset=True)
    user = repositories.update_user(db, current_user, **updates)
    return UserPublic.model_validate(user)
