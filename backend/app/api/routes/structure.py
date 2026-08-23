"""The nested creation chain: building -> floor -> room -> bed.

These routes are addressed by their parent's id rather than by {pg_id}, so each
one resolves which PG the parent belongs to and then runs the same access check
every other PG-scoped route runs (ensure_pg_access). The check is shared, not
re-implemented — only the way the pg_id is discovered differs.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, RequireOwner, ensure_pg_access
from app.models.enums import BedStatus
from app.models.property import Bed, Building, Floor, Room
from app.schemas.property import (
    BedCreate,
    BedOut,
    BedStatusUpdate,
    FloorCreate,
    FloorOut,
    RoomCreate,
    RoomOut,
)

router = APIRouter(tags=["rooms-and-beds"])


async def _pg_id_for_building(db: DbSession, building_id: uuid.UUID) -> tuple[Building, uuid.UUID]:
    building = await db.get(Building, building_id)
    if building is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Building not found")
    return building, building.pg_id


async def _pg_id_for_floor(db: DbSession, floor_id: uuid.UUID) -> tuple[Floor, uuid.UUID]:
    row = (
        await db.execute(
            select(Floor, Building.pg_id)
            .join(Building, Floor.building_id == Building.id)
            .where(Floor.id == floor_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Floor not found")
    return row[0], row[1]


async def _pg_id_for_room(db: DbSession, room_id: uuid.UUID) -> tuple[Room, uuid.UUID]:
    row = (
        await db.execute(
            select(Room, Building.pg_id)
            .join(Floor, Room.floor_id == Floor.id)
            .join(Building, Floor.building_id == Building.id)
            .where(Room.id == room_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")
    return row[0], row[1]


async def _pg_id_for_bed(db: DbSession, bed_id: uuid.UUID) -> tuple[Bed, uuid.UUID]:
    row = (
        await db.execute(
            select(Bed, Building.pg_id)
            .join(Room, Bed.room_id == Room.id)
            .join(Floor, Room.floor_id == Floor.id)
            .join(Building, Floor.building_id == Building.id)
            .where(Bed.id == bed_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bed not found")
    return row[0], row[1]


@router.post(
    "/buildings/{building_id}/floors",
    response_model=FloorOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_floor(
    building_id: uuid.UUID, payload: FloorCreate, owner: RequireOwner, db: DbSession
) -> Floor:
    _, pg_id = await _pg_id_for_building(db, building_id)
    await ensure_pg_access(db, owner, pg_id)

    floor = Floor(
        building_id=building_id,
        floor_label=payload.floor_label,
        floor_order=payload.floor_order,
    )
    db.add(floor)
    await db.commit()
    await db.refresh(floor)
    return floor


@router.get("/buildings/{building_id}/floors", response_model=list[FloorOut])
async def list_building_floors(
    building_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> list[Floor]:
    """Floors in one building, for the building-scoped view."""
    _, pg_id = await _pg_id_for_building(db, building_id)
    await ensure_pg_access(db, user, pg_id)

    result = await db.scalars(
        select(Floor)
        .where(Floor.building_id == building_id)
        .order_by(Floor.floor_order, Floor.floor_label)
    )
    return list(result)


@router.post(
    "/floors/{floor_id}/rooms", response_model=RoomOut, status_code=status.HTTP_201_CREATED
)
async def create_room(
    floor_id: uuid.UUID, payload: RoomCreate, owner: RequireOwner, db: DbSession
) -> Room:
    _, pg_id = await _pg_id_for_floor(db, floor_id)
    await ensure_pg_access(db, owner, pg_id)

    duplicate = await db.scalar(
        select(Room.id).where(
            Room.floor_id == floor_id, Room.room_number == payload.room_number
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Room {payload.room_number} already exists on this floor",
        )

    room = Room(
        floor_id=floor_id,
        room_number=payload.room_number,
        room_type=payload.room_type,
        total_beds=payload.total_beds,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.post(
    "/rooms/{room_id}/beds", response_model=BedOut, status_code=status.HTTP_201_CREATED
)
async def create_bed(
    room_id: uuid.UUID, payload: BedCreate, owner: RequireOwner, db: DbSession
) -> Bed:
    room, pg_id = await _pg_id_for_room(db, room_id)
    await ensure_pg_access(db, owner, pg_id)

    # rooms.total_beds is the room's declared capacity, so adding beds past it
    # would make the Rooms & Beds screen show a room over its own capacity.
    # Refusing here keeps "total beds" meaning one thing everywhere.
    existing_beds = await db.scalar(
        select(func.count(Bed.id)).where(Bed.room_id == room_id)
    )
    if existing_beds >= room.total_beds:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Room {room.room_number} is declared with {room.total_beds} bed(s) and "
            f"already has {existing_beds}. Increase the room's total_beds first.",
        )

    duplicate = await db.scalar(
        select(Bed.id).where(Bed.room_id == room_id, Bed.bed_label == payload.bed_label)
    )
    if duplicate is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Bed '{payload.bed_label}' already exists in this room",
        )

    bed = Bed(
        room_id=room_id, bed_label=payload.bed_label, monthly_rent=payload.monthly_rent
    )
    db.add(bed)
    await db.commit()
    await db.refresh(bed)
    return bed


@router.patch("/beds/{bed_id}/status", response_model=BedOut)
async def update_bed_status(
    bed_id: uuid.UUID, payload: BedStatusUpdate, user: CurrentUser, db: DbSession
) -> Bed:
    """Manual bed-status override, for the 'Rooms Needing Attention' panel.

    Only vacant <-> maintenance is settable by hand. 'occupied' is a
    consequence of a tenant being assigned to the bed, which is Phase 2 work —
    letting this endpoint set it would create beds that show as occupied with
    nobody in them, and the whole occupancy view is built on that status being
    true.
    """
    bed, pg_id = await _pg_id_for_bed(db, bed_id)
    await ensure_pg_access(db, user, pg_id)

    if payload.status == BedStatus.OCCUPIED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A bed becomes occupied by assigning a tenant to it, not by setting "
            "its status directly. Tenant assignment arrives in Phase 2.",
        )
    if bed.status == BedStatus.OCCUPIED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This bed is occupied. Vacate it before changing its status.",
        )

    bed.status = payload.status
    await db.commit()
    await db.refresh(bed)
    return bed
