"""
Pydantic schemas for user profile self-service and admin user management.

`UserProfileUpdate` deliberately has no `role` or `company_id` field - a
user can never grant themselves a new role or move companies through
`PATCH /api/users/me`, no matter what extra JSON keys they send, because
Pydantic simply has nowhere to put them. Role/company changes only exist on
the admin-only `UserAdminUpdate` schema used by `PATCH /api/company/users/{id}`.
"""

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)


class UserAdminCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.VIEWER


class UserAdminUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None


class UserListItem(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool
    created_at: str
