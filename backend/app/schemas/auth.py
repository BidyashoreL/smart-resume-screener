"""
Pydantic schemas for the authentication domain: registration, login, token
responses, and the safe (never includes `password_hash`) user/company shapes
returned by the API.
"""

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    company_name: str = Field(..., min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class CompanyPublic(BaseModel):
    id: str
    name: str
    industry: str | None = None
    website: str | None = None
    description: str | None = None
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """The user shape returned by auth endpoints - deliberately excludes
    `password_hash`, which never leaves `app/core/security.py`."""

    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    company_id: str
    is_active: bool

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    company: CompanyPublic


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds.")
    user: UserPublic
