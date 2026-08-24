"""
Authentication endpoints: registration, login, token refresh, logout, and
the current-user identity check.

Password hashing and JWT issuance/validation live entirely in
`app.core.security`; this module only wires HTTP request/response shapes
around those primitives plus the refresh-token cookie - no crypto here.

Token strategy: a short-lived access token is returned in the JSON body
(the frontend holds it in memory/localStorage and sends it as
`Authorization: Bearer <token>`); a longer-lived refresh token is set as an
HttpOnly cookie scoped to `/api/auth` so client-side JS never sees it,
and is tracked server-side (see `app/models/refresh_token.py`) so it can be
rotated on every refresh and revoked on logout.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.exceptions import (
    DuplicateEmailError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidTokenError,
)
from app.core.logging import get_logger
from app.core.security import TokenType
from app.db import repositories
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    CompanyPublic,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)

router = APIRouter()
logger = get_logger(__name__)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _issue_session(db: Session, response: Response, user: User) -> str:
    """Creates a new access token, plus a new server-tracked refresh token
    set as an HttpOnly cookie. Returns the access token for the JSON body."""
    settings = get_settings()

    access_token = security.create_access_token(
        user_id=user.id, company_id=user.company_id, role=user.role.value
    )

    token_id = security.new_token_id()
    raw_refresh_token = security.create_refresh_token(
        user_id=user.id, company_id=user.company_id, role=user.role.value, jti=token_id
    )
    repositories.create_refresh_token_record(
        db,
        id=token_id,
        user_id=user.id,
        token_hash=security.hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )

    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_refresh_token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/auth",
    )
    return access_token


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Creates a brand-new company AND its first user in one step: the
    registering user becomes that company's ADMIN. There is no separate
    "join an existing company" flow yet - additional teammates are added by
    an existing ADMIN via `POST /api/company/users`.
    """
    email = _normalize_email(payload.email)
    if repositories.get_user_by_email(db, email) is not None:
        raise DuplicateEmailError("An account with this email already exists.")

    company = repositories.create_company(db, name=payload.company_name.strip())
    user = repositories.create_user(
        db,
        company_id=company.id,
        email=email,
        password_hash=security.hash_password(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        role=UserRole.ADMIN,
    )
    logger.info("Registered new company=%s (admin user=%s)", company.id, user.id)

    access_token = _issue_session(db, response, user)
    settings = get_settings()
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserPublic.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    email = _normalize_email(payload.email)
    user = repositories.get_user_by_email(db, email)

    # Same error regardless of *why* auth failed (no account vs. wrong
    # password), so a caller can't use this endpoint to enumerate accounts.
    if user is None or not security.verify_password(payload.password, user.password_hash):
        raise InvalidCredentialsError("Incorrect email or password.")
    if not user.is_active:
        raise InactiveUserError("This account has been deactivated.")

    access_token = _issue_session(db, response, user)
    settings = get_settings()
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserPublic.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Exchanges the HttpOnly refresh cookie for a new access token. The
    refresh token itself is rotated (this one is revoked, a new one is
    issued) so a stolen-and-replayed refresh token has at most a single use
    before the legitimate client's next refresh call fails, which is a
    reasonable early signal that a token was compromised.
    """
    settings = get_settings()
    raw_token = request.cookies.get(settings.refresh_cookie_name)
    if not raw_token:
        raise InvalidTokenError("No refresh token supplied.")

    payload = security.decode_token(raw_token, expected_type=TokenType.REFRESH)
    token_record = repositories.get_refresh_token(db, payload.get("jti", ""))
    if (
        token_record is None
        or token_record.revoked
        or token_record.token_hash != security.hash_refresh_token(raw_token)
    ):
        raise InvalidTokenError("Refresh token has been revoked or is invalid.")

    user = repositories.get_user_by_id(db, token_record.user_id)
    if user is None or not user.is_active:
        raise InactiveUserError("This account is no longer active.")

    repositories.revoke_refresh_token(db, token_record)
    access_token = _issue_session(db, response, user)

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserPublic.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    settings = get_settings()
    raw_token = request.cookies.get(settings.refresh_cookie_name)
    if raw_token:
        try:
            payload = security.decode_token(raw_token, expected_type=TokenType.REFRESH)
            token_record = repositories.get_refresh_token(db, payload.get("jti", ""))
            if token_record is not None:
                repositories.revoke_refresh_token(db, token_record)
        except InvalidTokenError:
            pass  # already invalid/expired - nothing left to revoke
    response.delete_cookie(key=settings.refresh_cookie_name, path="/api/auth")


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    company = repositories.get_company(db, current_user.company_id)
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role,
        company=CompanyPublic.model_validate(company),
    )
