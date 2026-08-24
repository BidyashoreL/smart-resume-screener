"""
Password hashing and JWT issuance/verification.

This is the ONLY module in the application that touches a password hash or
encodes/decodes a JWT. Routes and dependencies call into these functions
rather than hashing or signing anything themselves - see `app/api/routes_auth.py`
and `app/core/deps.py`.

Password hashing uses Argon2id (via `argon2-cffi`), the current OWASP
recommendation for password storage. JWTs are signed with HS256 using
`settings.jwt_secret_key`; access and refresh tokens are distinguished by a
`type` claim so an access token can never be replayed as a refresh token
(or vice versa) even though both are signed with the same secret.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerifyMismatchError

from app.core.config import get_settings
from app.core.exceptions import InvalidTokenError

_password_hasher = PasswordHasher()


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


# --- Passwords --------------------------------------------------------------


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHash):
        return False


# --- JWTs ---------------------------------------------------------------


def _create_token(
    *,
    subject: str,
    company_id: str,
    role: str,
    token_type: TokenType,
    expires_delta: timedelta,
    jti: str | None = None,
) -> str:
    """
    Builds a minimal-claim JWT: `sub` (user id), `company_id`, `role`, and
    `type`, plus standard `iat`/`exp`. No email, name, or other identifying
    data goes in the token - the authenticated user is re-loaded from the
    database on every request (see `deps.get_current_user`), so the token
    only needs to carry enough to look that row up and know its type/expiry.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "company_id": company_id,
        "role": role,
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
    }
    if jti is not None:
        payload["jti"] = jti

    settings = get_settings()
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: str, company_id: str, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject=user_id,
        company_id=company_id,
        role=role,
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(*, user_id: str, company_id: str, role: str, jti: str) -> str:
    """`jti` must match the id of the `RefreshToken` row tracking this token,
    so `deps`/`routes_auth` can revoke it server-side (logout, rotation)."""
    settings = get_settings()
    return _create_token(
        subject=user_id,
        company_id=company_id,
        role=role,
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        jti=jti,
    )


def decode_token(token: str, *, expected_type: TokenType) -> dict:
    """Validates signature and expiration, then enforces the `type` claim so
    a refresh token can never be used where an access token is expected."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise InvalidTokenError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError("Token is invalid.") from exc

    if payload.get("type") != expected_type.value:
        raise InvalidTokenError("Unexpected token type.")

    return payload


def hash_refresh_token(raw_token: str) -> str:
    """
    Refresh tokens are stored server-side as a hash, not the raw value, so a
    database dump alone cannot be replayed as a working refresh token -
    forging one still requires the JWT signing secret. This is a plain
    integrity hash (not a slow password hash), since the input is already a
    high-entropy signed token, not a human-chosen secret.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def new_token_id() -> str:
    return secrets.token_urlsafe(24)
