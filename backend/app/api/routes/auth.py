"""Registration, login, refresh, logout, and /auth/me."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.enums import UserRole
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    OwnerRegisterRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    TokenPair,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue_token_pair(db: DbSession, user: User) -> TokenPair:
    raw_refresh, token_hash, expires_at = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    await db.commit()
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=raw_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register_owner(payload: OwnerRegisterRequest, db: DbSession) -> TokenPair:
    """Owner registration only.

    Staff accounts are created by an owner via POST /staff, and tenants arrive
    in Phase 2 — neither self-registers, so this endpoint hardcodes role=owner
    rather than accepting a role from the request body. Letting a caller choose
    their own role would make every permission check downstream meaningless.
    """
    existing = await db.scalar(
        select(User).where(or_(User.email == payload.email, User.phone == payload.phone))
    )
    if existing is not None:
        field = "email" if existing.email == payload.email else "phone number"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with this {field} already exists",
        )

    user = User(
        role=UserRole.OWNER,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _issue_token_pair(db, user)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, db: DbSession) -> TokenPair:
    """One login endpoint for every role — the role comes back in the token."""
    user = await db.scalar(select(User).where(User.email == payload.email))

    # Same error and roughly the same work whether the email is unknown or the
    # password is wrong, so this cannot be used to enumerate accounts.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )

    return await _issue_token_pair(db, user)


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(payload: RefreshRequest, db: DbSession) -> TokenPair:
    """Exchange a valid refresh token for a new pair.

    The presented token is revoked as part of the exchange (rotation), so a
    stolen refresh token is usable at most once before it stops working.
    """
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )

    now = datetime.now(timezone.utc)
    if stored is None or stored.revoked_at is not None or stored.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    stored.revoked_at = now
    return await _issue_token_pair(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: DbSession) -> None:
    """Revoke the presented refresh token.

    Deliberately silent about whether the token existed: logging out is not a
    place to tell a caller whether a token is real.
    """
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None)
        )
    )
    if stored is not None:
        stored.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("/me", response_model=UserOut)
async def read_current_user(user: CurrentUser) -> User:
    """Who am I — the frontend calls this after login to pick which shell to render."""
    return user


@router.patch("/me", response_model=UserOut)
async def update_current_user(
    payload: ProfileUpdateRequest, user: CurrentUser, db: DbSession
) -> User:
    """Edit your own profile.

    Email and phone are unique across all users, so a collision is reported as
    a conflict rather than surfacing as a raw database error.
    """
    if payload.email is not None and payload.email != user.email:
        taken = await db.scalar(
            select(User.id).where(User.email == payload.email, User.id != user.id)
        )
        if taken is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another account already uses this email",
            )
        user.email = payload.email

    if payload.phone is not None and payload.phone != user.phone:
        taken = await db.scalar(
            select(User.id).where(User.phone == payload.phone, User.id != user.id)
        )
        if taken is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another account already uses this phone number",
            )
        user.phone = payload.phone

    if payload.full_name is not None:
        user.full_name = payload.full_name

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, db: DbSession
) -> None:
    """Change your own password, proving you know the current one.

    Every other session is signed out as a side effect: all outstanding refresh
    tokens are revoked, so a password change actually ends access obtained with
    the old one instead of leaving it valid for another week.
    """
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(payload.new_password)

    now = datetime.now(timezone.utc)
    outstanding = await db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    )
    for token in outstanding:
        token.revoked_at = now

    await db.commit()
