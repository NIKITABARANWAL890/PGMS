"""Owner-side staff management, and the staff member's own PG list.

There is no permission-picker anywhere in this file, by design. Staff
capability is a single fixed set (Product plan section 2A); what an owner
actually configures per staff member is PG access, which is what
staff_assignments records.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, RequireOwner
from app.core.security import generate_temp_password, hash_password
from app.models.enums import UserRole
from app.models.property import PG
from app.models.staff_assignment import StaffAssignment
from app.models.user import User
from app.schemas.property import PGOut
from app.schemas.staff import (
    StaffCreate,
    StaffCreatedOut,
    StaffOut,
    StaffPGAssignmentUpdate,
    StaffUpdate,
)

router = APIRouter(prefix="/staff", tags=["staff"])


async def _owned_pg_ids(db: AsyncSession, owner: User) -> set[uuid.UUID]:
    rows = await db.scalars(select(PG.id).where(PG.owner_id == owner.id))
    return set(rows)


async def _validate_pg_ids(
    db: AsyncSession, owner: User, pg_ids: list[uuid.UUID]
) -> list[uuid.UUID]:
    """Refuse assignment to a PG this owner does not own.

    Without this, one owner could hand their staff member access to another
    owner's PG just by passing its id -- the assignment table itself has no way
    to tell the difference.
    """
    unique_ids = list(dict.fromkeys(pg_ids))
    owned = await _owned_pg_ids(db, owner)
    unknown = [str(pid) for pid in unique_ids if pid not in owned]
    if unknown:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You do not own these PG(s): " + ", ".join(unknown),
        )
    return unique_ids


async def _load_staff_for_owner(
    db: AsyncSession, owner: User, staff_id: uuid.UUID
) -> User:
    """Load a staff member assigned to at least one of this owner's PGs."""
    owned = await _owned_pg_ids(db, owner)
    if not owned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")

    staff = await db.scalar(
        select(User)
        .join(StaffAssignment, StaffAssignment.staff_id == User.id)
        .where(
            User.id == staff_id,
            User.role == UserRole.STAFF,
            StaffAssignment.pg_id.in_(owned),
        )
        .options(selectinload(User.staff_pgs))
    )
    if staff is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")
    return staff


def _to_staff_out(staff: User) -> StaffOut:
    return StaffOut(
        id=staff.id,
        full_name=staff.full_name,
        email=staff.email,
        phone=staff.phone,
        staff_title=staff.staff_title,
        is_active=staff.is_active,
        assigned_pgs=[PGOut.model_validate(p) for p in staff.staff_pgs],
    )


@router.post("", response_model=StaffCreatedOut, status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: StaffCreate, owner: RequireOwner, db: DbSession
) -> StaffCreatedOut:
    """Create a staff account and its PG assignments in one transaction.

    The users row and every staff_assignments row commit together or not at
    all -- a half-completed create would leave a staff account that can log in
    but reaches no PG, which is worse than a clean failure.
    """
    pg_ids = await _validate_pg_ids(db, owner, payload.pg_ids)

    existing = await db.scalar(
        select(User).where(
            or_(User.email == payload.email, User.phone == payload.phone)
        )
    )
    if existing is not None:
        field = "email" if existing.email == payload.email else "phone number"
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An account with this " + field + " already exists",
        )

    temp_password = generate_temp_password()
    staff = User(
        role=UserRole.STAFF,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        staff_title=payload.staff_title,
        password_hash=hash_password(temp_password),
    )
    db.add(staff)
    # flush, not commit: this assigns staff.id so the assignment rows can
    # reference it, while keeping everything inside one open transaction.
    await db.flush()

    for pg_id in pg_ids:
        db.add(StaffAssignment(staff_id=staff.id, pg_id=pg_id))

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Could not create staff account"
        ) from exc

    await db.refresh(staff, ["staff_pgs"])
    return StaffCreatedOut(
        **_to_staff_out(staff).model_dump(), temporary_password=temp_password
    )


@router.get("", response_model=list[StaffOut])
async def list_staff(owner: RequireOwner, db: DbSession) -> list[StaffOut]:
    """Staff across all of this owner's PGs -- the Staff Overview table."""
    owned = await _owned_pg_ids(db, owner)
    if not owned:
        return []

    staff_members = list(
        await db.scalars(
            select(User)
            .join(StaffAssignment, StaffAssignment.staff_id == User.id)
            .where(User.role == UserRole.STAFF, StaffAssignment.pg_id.in_(owned))
            .options(selectinload(User.staff_pgs))
            .order_by(User.full_name)
            .distinct()
        )
    )
    return [_to_staff_out(s) for s in staff_members]


@router.patch("/{staff_id}", response_model=StaffOut)
async def update_staff(
    staff_id: uuid.UUID, payload: StaffUpdate, owner: RequireOwner, db: DbSession
) -> StaffOut:
    staff = await _load_staff_for_owner(db, owner, staff_id)

    if payload.full_name is not None:
        staff.full_name = payload.full_name
    if payload.staff_title is not None:
        staff.staff_title = payload.staff_title
    if payload.is_active is not None:
        staff.is_active = payload.is_active

    await db.commit()
    await db.refresh(staff, ["staff_pgs"])
    return _to_staff_out(staff)


@router.patch("/{staff_id}/pgs", response_model=StaffOut)
async def update_staff_pgs(
    staff_id: uuid.UUID,
    payload: StaffPGAssignmentUpdate,
    owner: RequireOwner,
    db: DbSession,
) -> StaffOut:
    """Replace this staff member's PG access, without recreating the account."""
    staff = await _load_staff_for_owner(db, owner, staff_id)
    target_pg_ids = set(await _validate_pg_ids(db, owner, payload.pg_ids))

    owned = await _owned_pg_ids(db, owner)
    current = list(
        await db.scalars(
            select(StaffAssignment).where(
                StaffAssignment.staff_id == staff.id,
                StaffAssignment.pg_id.in_(owned),
            )
        )
    )
    current_pg_ids = {a.pg_id for a in current}

    for assignment in current:
        if assignment.pg_id not in target_pg_ids:
            await db.delete(assignment)

    for pg_id in target_pg_ids - current_pg_ids:
        db.add(StaffAssignment(staff_id=staff.id, pg_id=pg_id))

    await db.commit()
    await db.refresh(staff, ["staff_pgs"])
    return _to_staff_out(staff)


@router.get("/me/pgs", response_model=list[PGOut])
async def list_my_assigned_pgs(user: CurrentUser, db: DbSession) -> list[PG]:
    """The PGs the calling staff member is assigned to -- and only those.

    This is the staff-side entry point: an owner's other PGs are not merely
    hidden from this list, they are unreachable, because every PG-scoped route
    runs the same assignment check before returning anything.
    """
    if user.role != UserRole.STAFF:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "This endpoint is for staff accounts"
        )

    result = await db.scalars(
        select(PG)
        .join(StaffAssignment, StaffAssignment.pg_id == PG.id)
        .where(StaffAssignment.staff_id == user.id)
        .order_by(PG.name)
    )
    return list(result)
