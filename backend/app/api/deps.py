"""Auth dependencies — the single place access control is decided.

Three layers, each built on the one above:

  1. get_current_user  — who is calling (valid token, live account)
  2. require_role(...)  — is this role allowed here at all
  3. get_accessible_pg  — may this specific user reach this specific PG

Every protected route in every later phase should depend on these rather than
re-deriving access checks. A duplicate of layer 3 written somewhere else is a
data-leak bug waiting to happen, because it will not get fixed when this one
does — that is precisely why the Multi-PG Access Rule lives in one function.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.property import PG
from app.models.staff_assignment import StaffAssignment
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None:
        raise CREDENTIALS_ERROR

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise CREDENTIALS_ERROR

    try:
        user_id = uuid.UUID(payload.get("sub", ""))
    except (ValueError, TypeError):
        raise CREDENTIALS_ERROR

    user = await db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_ERROR
    # Deactivating a user takes effect on their next request rather than
    # waiting for their access token to expire.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


def require_role(*roles: UserRole):
    """Dependency factory: restrict a route to the given role(s)."""

    allowed = set(roles)

    async def _check(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action is not available for your role",
            )
        return user

    return _check


async def user_can_access_pg(db: AsyncSession, user: User, pg_id: uuid.UUID) -> bool:
    """The Multi-PG Access Rule, in one place.

    An owner reaches the PGs they own. A staff member reaches only the PGs they
    have a `staff_assignments` row for — never every PG their owner has.
    Tenants reach no PG through this path in Phase 1.
    """
    if user.role == UserRole.OWNER:
        found = await db.scalar(
            select(PG.id).where(PG.id == pg_id, PG.owner_id == user.id)
        )
        return found is not None

    if user.role == UserRole.STAFF:
        found = await db.scalar(
            select(StaffAssignment.id).where(
                StaffAssignment.staff_id == user.id,
                StaffAssignment.pg_id == pg_id,
            )
        )
        return found is not None

    return False


async def get_accessible_pg(
    pg_id: Annotated[uuid.UUID, Path()],
    user: CurrentUser,
    db: DbSession,
) -> PG:
    """Load a PG the caller is allowed to reach, or refuse explicitly.

    Refusing with 403 rather than filtering the PG out of a list is deliberate:
    an empty result cannot be told apart from "this PG has nothing in it", so a
    silently-filtering endpoint hides a broken permission check instead of
    surfacing it. The denial has to be visible to be testable.
    """
    pg = await db.get(PG, pg_id)
    if pg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PG not found"
        )

    if not await user_can_access_pg(db, user, pg_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this PG",
        )
    return pg


AccessiblePG = Annotated[PG, Depends(get_accessible_pg)]
RequireOwner = Annotated[User, Depends(require_role(UserRole.OWNER))]
RequireOwnerOrStaff = Annotated[User, Depends(require_role(UserRole.OWNER, UserRole.STAFF))]


async def ensure_pg_access(db: AsyncSession, user: User, pg_id: uuid.UUID) -> None:
    """Same rule as get_accessible_pg, for routes whose path has no {pg_id}.

    The nested creation chain (/buildings/{id}/floors and friends) identifies a
    PG indirectly, so those handlers resolve the owning pg_id first and then
    call this. Same check, same 403 — just reached by a different route shape.
    """
    if not await user_can_access_pg(db, user, pg_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this PG",
        )
