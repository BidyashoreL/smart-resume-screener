"""
Company profile and team-member management.

Every endpoint here is scoped to `current_user.company_id` - an ADMIN can
view/update their own company and manage users within it, but has no way to
address another company's data through this router: user-management routes
look the target user up *within* the caller's own company
(`_get_company_scoped_user`), so a cross-tenant id behaves exactly like an
id that doesn't exist (404), never revealing that the user exists elsewhere.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.exceptions import DuplicateEmailError, LastAdminError, UserNotFoundError
from app.core.security import hash_password
from app.db import repositories
from app.db.database import get_db
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.company import CompanyDetail, CompanyUpdate
from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserListItem

router = APIRouter()

_require_admin = require_role(UserRole.ADMIN)


def _company_to_detail(company: Company) -> CompanyDetail:
    return CompanyDetail(
        id=company.id,
        name=company.name,
        industry=company.industry,
        website=company.website,
        description=company.description,
        logo_url=company.logo_url,
        created_at=company.created_at.isoformat(),
        updated_at=company.updated_at.isoformat(),
    )


def _user_to_list_item(user: User) -> UserListItem:
    return UserListItem(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


def _get_company_scoped_user(db: Session, user_id: str, company_id: str) -> User:
    user = repositories.get_user_by_id(db, user_id)
    if user is None or user.company_id != company_id:
        # Same 404 whether the id is entirely made up or belongs to another
        # company - never confirm cross-tenant existence to the caller.
        raise UserNotFoundError(f"No user with id '{user_id}' in your company.")
    return user


# --- Company profile ---------------------------------------------------


@router.get("", response_model=CompanyDetail)
def get_my_company(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CompanyDetail:
    """Any authenticated role can view their own company's profile."""
    company = repositories.get_company(db, current_user.company_id)
    return _company_to_detail(company)


@router.patch("", response_model=CompanyDetail)
def update_my_company(
    payload: CompanyUpdate,
    current_user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> CompanyDetail:
    """Only ADMIN may change company-level settings."""
    company = repositories.get_company(db, current_user.company_id)
    updates = payload.model_dump(exclude_unset=True)
    company = repositories.update_company(db, company, **updates)
    return _company_to_detail(company)


# --- Team / user management (ADMIN only) --------------------------------


@router.get("/users", response_model=list[UserListItem])
def list_company_users(
    current_user: User = Depends(_require_admin), db: Session = Depends(get_db)
) -> list[UserListItem]:
    users = repositories.list_company_users(db, current_user.company_id)
    return [_user_to_list_item(u) for u in users]


@router.post("/users", response_model=UserListItem, status_code=201)
def create_company_user(
    payload: UserAdminCreate,
    current_user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> UserListItem:
    email = payload.email.strip().lower()
    if repositories.get_user_by_email(db, email) is not None:
        raise DuplicateEmailError("An account with this email already exists.")

    user = repositories.create_user(
        db,
        company_id=current_user.company_id,
        email=email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        role=payload.role,
    )
    return _user_to_list_item(user)


@router.patch("/users/{user_id}", response_model=UserListItem)
def update_company_user(
    user_id: str,
    payload: UserAdminUpdate,
    current_user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> UserListItem:
    target = _get_company_scoped_user(db, user_id, current_user.company_id)
    updates = payload.model_dump(exclude_unset=True)

    is_demoting_from_admin = "role" in updates and updates["role"] != UserRole.ADMIN
    is_deactivating = updates.get("is_active") is False
    if target.role == UserRole.ADMIN and target.is_active and (is_demoting_from_admin or is_deactivating):
        if repositories.count_active_admins(db, current_user.company_id) <= 1:
            raise LastAdminError("Cannot remove or demote the last active admin of a company.")

    target = repositories.update_user(db, target, **updates)
    return _user_to_list_item(target)


@router.delete("/users/{user_id}", status_code=204)
def deactivate_company_user(
    user_id: str,
    current_user: User = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> None:
    """
    Soft-delete: deactivates the account (`is_active = False`) rather than
    removing the row, so existing screening/audit history stays intact and
    the account can be reactivated later via PATCH if needed.
    """
    target = _get_company_scoped_user(db, user_id, current_user.company_id)

    if target.role == UserRole.ADMIN and target.is_active:
        if repositories.count_active_admins(db, current_user.company_id) <= 1:
            raise LastAdminError("Cannot deactivate the last active admin of a company.")

    repositories.update_user(db, target, is_active=False)
