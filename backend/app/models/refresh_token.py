"""SQLAlchemy model for issued refresh tokens (enables rotation/revocation)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _new_refresh_token_id() -> str:
    # Doubles as the JWT `jti` claim, so a refresh token can be looked up
    # and revoked server-side without storing the raw token as the key.
    return f"rt_{uuid.uuid4().hex}"


class RefreshToken(Base):
    """
    Server-side record of an issued refresh token. A stateless JWT alone
    cannot be revoked before it expires; this table is what makes logout and
    refresh-token rotation actually invalidate a token rather than just
    stop the client from sending it. `token_hash` stores a hash of the raw
    token (see `security.hash_refresh_token`), not the token itself, so a
    database leak alone cannot be replayed as a working credential.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_refresh_token_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
