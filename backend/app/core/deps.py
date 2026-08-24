"""
Reusable FastAPI dependencies for authentication and authorization.

Every protected route depends on `get_current_user` - no route decodes a
JWT or queries the users table itself. RBAC-restricted routes additionally
depend on `require_role(...)`. Tenant scoping happens in the routes and
repositories, always keyed off `current_user.company_id` (loaded fresh from
the database on every request), never off anything the client sends.
"""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import security
from app.core.exceptions import InactiveUserError, InvalidTokenError, PermissionDeniedError
from app.core.security import TokenType
from app.db import repositories
from app.db.database import get_db
from app.models.user import User, UserRole

# auto_error=False so a missing Authorization header raises our own
# InvalidTokenError (-> consistent {"error", "detail"} JSON body) instead of
# FastAPI's default 403 with a differently-shaped error payload.
_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extracts and validates the access token, loads the corresponding user,
    and verifies it's still active. This is the single place in the app
    that turns "a bearer token was supplied" into "here is the authenticated
    user" - every protected route depends on this rather than repeating the
    steps itself.
    """
    if credentials is None or not credentials.credentials:
        raise InvalidTokenError("Missing bearer token.")

    payload = security.decode_token(credentials.credentials, expected_type=TokenType.ACCESS)

    user = repositories.get_user_by_id(db, payload.get("sub", ""))
    if user is None:
        raise InvalidTokenError("Token does not correspond to an existing user.")
    if not user.is_active:
        raise InactiveUserError("This account has been deactivated.")

    return user


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory: `Depends(require_role(UserRole.ADMIN))` (or several
    roles) both authenticates the caller (via `get_current_user`) and
    enforces that their role is one of `allowed_roles`. Authorization is
    decided from the freshly-loaded database user, never from JWT claims
    alone, so a role change takes effect immediately rather than waiting
    for the (short-lived) access token to expire.
    """

    def _check_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise PermissionDeniedError(
                f"Role '{current_user.role.value}' is not permitted to perform this action."
            )
        return current_user

    return _check_role
