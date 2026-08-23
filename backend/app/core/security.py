"""Password hashing and JWT / refresh-token primitives.

Kept deliberately small and free of database or FastAPI imports so it can be
unit-tested on its own — the auth *dependencies* live in app/api/deps.py.
"""

from __future__ import annotations

import hashlib
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt silently truncates anything past 72 bytes, so the API layer rejects
# longer passwords rather than accepting a password whose tail does nothing.
BCRYPT_MAX_BYTES = 72

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------- passwords


def hash_password(plain_password: str) -> str:
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, password_hash)
    except ValueError:
        # Malformed/oversized input should read as "wrong password", not 500.
        return False


def generate_temp_password(length: int = 12) -> str:
    """A readable one-time password for owner-created staff accounts.

    Staff accounts are created *by* an owner (there is no staff self-signup in
    Phase 1), so the account needs a credential the owner can hand over.
    """
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# -------------------------------------------------------------- access JWTs


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    """Return the token payload, or None if it is invalid/expired/wrong-type."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        return None
    if payload.get("type") != "access":
        return None
    return payload


# ------------------------------------------------------------ refresh tokens
# Refresh tokens are opaque random strings, not JWTs: they must be revocable,
# and a stateless JWT cannot be revoked. Only the SHA-256 hash is stored, so a
# database leak does not hand out usable sessions.


def create_refresh_token() -> tuple[str, str, datetime]:
    """Return (raw_token, token_hash, expires_at)."""
    raw = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    return raw, hash_refresh_token(raw), expires_at


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
