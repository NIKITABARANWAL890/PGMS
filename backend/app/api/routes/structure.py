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
    BedGenerate,
    BedOut,
    BedStatusUpdate,
    BedUpdate,
    BuildingUpdate,
    FloorCreate,
    FloorGenerate,
    FloorOut,
    RoomCreate,
    RoomOut,
    RoomUpdate,
)

router = APIRouter(tags=["rooms-and-beds"])

# Guide 3.6: "ask for a bed count and automatically create Bed A, Bed B, Bed C".
BED_LABELS = ["Bed " + chr(ord('A') + i) for i in range(26)]


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


async def _occupied_beds_under(db: DbSession, **scope) -> int:
    """How many beds under this part of the tree currently hold a tenant.

    Deleting structure with an occupied bed would remove somebody's room out
    from under them, so every delete route checks this first. In Phase 1 no
    tenant can occupy a bed yet, which is exactly why the guard belongs here
    now -- it is far cheaper to write while the answer is always zero than to
    retrofit once Phase 2 can make it non-zero.
    """
    query = (
        select(func.count(Bed.id))
        .join(Room, Bed.room_id == Room.id)
        .join(Floor, Room.floor_id == Floor.id)
        .join(Building, Floor.building_id == Building.id)
        .where(Bed.status == BedStatus.OCCUPIED)
    )
    if "pg_id" in scope:
        query = query.where(Building.pg_id == scope["pg_id"])
    if "building_id" in scope:
        query = query.where(Building.id == scope["building_id"])
    if "floor_id" in scope:
        query = query.where(Floor.id == scope["floor_id"])
    if "room_id" in scope:
        query = query.where(Room.id == scope["room_id"])
    return await db.scalar(query) or 0


def _refuse_if_occupied(occupied: int, what: str) -> None:
    if occupied:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{what} still has {occupied} occupied bed(s). Move those tenants out "
            "before deleting it.",
        )


@router.post(
    "/buildings/{building_id}/floors/generate",
    response_model=list[FloorOut],
    status_code=status.HTTP_201_CREATED,
)
async def generate_floors(
    building_id: uuid.UUID, payload: FloorGenerate, owner: RequireOwner, db: DbSession
) -> list[Floor]:
    """Guide 3.3: the owner gives a floor count, the system creates Floor 1..N.

    Generating is additive rather than destructive -- asking for 4 floors on a
    building that already has 2 adds Floor 3 and Floor 4. Replacing them would
    delete rooms and beds already configured on the existing floors, which is
    never what "I have 4 floors" means.
    """
    _, pg_id = await _pg_id_for_building(db, building_id)
    await ensure_pg_access(db, owner, pg_id)

    existing = list(
        await db.scalars(
            select(Floor)
            .where(Floor.building_id == building_id)
            .order_by(Floor.floor_order)
        )
    )
    if len(existing) >= payload.floor_count:
        return existing[: payload.floor_count]

    created: list[Floor] = []
    for order in range(len(existing) + 1, payload.floor_count + 1):
        floor = Floor(
            building_id=building_id,
            floor_label="Floor " + str(order),
            floor_order=order,
        )
        db.add(floor)
        created.append(floor)

    await db.commit()
    for floor in created:
        await db.refresh(floor)
    return existing + created


@router.patch("/buildings/{building_id}")
async def update_building(
    building_id: uuid.UUID, payload: BuildingUpdate, owner: RequireOwner, db: DbSession
) -> dict:
    """Rename a building or set its code (guide 7: "Edit Building")."""
    building, pg_id = await _pg_id_for_building(db, building_id)
    await ensure_pg_access(db, owner, pg_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(building, field, value)
    await db.commit()
    await db.refresh(building)
    return {
        "id": str(building.id),
        "pg_id": str(building.pg_id),
        "name": building.name,
        "building_code": building.building_code,
    }


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
        monthly_rent=payload.monthly_rent,
        description=payload.description,
    )
    db.add(room)
    await db.flush()

    # Guide 3.6's shortcut. Beds inherit the room's rent -- the guide calls a
    # bed's own rent an override, so seeding them equal keeps the common case
    # correct without asking the owner for the same number twice.
    if payload.generate_beds:
        for label in BED_LABELS[: payload.total_beds]:
            db.add(
                Bed(room_id=room.id, bed_label=label, monthly_rent=payload.monthly_rent)
            )

    await db.commit()
    await db.refresh(room)
    return room


@router.get("/floors/{floor_id}/rooms", response_model=list[RoomOut])
async def list_floor_rooms(
    floor_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> list[Room]:
    """Rooms on one floor -- the Rooms tab's floor selector (guide 8)."""
    _, pg_id = await _pg_id_for_floor(db, floor_id)
    await ensure_pg_access(db, user, pg_id)

    result = await db.scalars(
        select(Room).where(Room.floor_id == floor_id).order_by(Room.room_number)
    )
    return list(result)


@router.patch("/rooms/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: uuid.UUID, payload: RoomUpdate, owner: RequireOwner, db: DbSession
) -> Room:
    room, pg_id = await _pg_id_for_room(db, room_id)
    await ensure_pg_access(db, owner, pg_id)

    data = payload.model_dump(exclude_unset=True)

    # Capacity cannot drop below the beds that already exist, or the room would
    # report itself over capacity the moment it is saved.
    if "total_beds" in data:
        existing = await db.scalar(
            select(func.count(Bed.id)).where(Bed.room_id == room_id)
        )
        if data["total_beds"] < existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This room already has "
                + str(existing)
                + " bed(s); remove some before reducing capacity to "
                + str(data["total_beds"])
                + ".",
            )

    if "room_number" in data and data["room_number"] != room.room_number:
        duplicate = await db.scalar(
            select(Room.id).where(
                Room.floor_id == room.floor_id,
                Room.room_number == data["room_number"],
                Room.id != room_id,
            )
        )
        if duplicate is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Room " + data["room_number"] + " already exists on this floor",
            )

    for field, value in data.items():
        setattr(room, field, value)
    await db.commit()
    await db.refresh(room)
    return room


@router.get("/rooms/{room_id}/beds", response_model=list[BedOut])
async def list_room_beds(room_id: uuid.UUID, user: CurrentUser, db: DbSession) -> list[Bed]:
    """Beds in one room -- the Beds tab's room selector (guide 9)."""
    _, pg_id = await _pg_id_for_room(db, room_id)
    await ensure_pg_access(db, user, pg_id)

    result = await db.scalars(
        select(Bed).where(Bed.room_id == room_id).order_by(Bed.bed_label)
    )
    return list(result)


@router.post(
    "/rooms/{room_id}/beds/generate",
    response_model=list[BedOut],
    status_code=status.HTTP_201_CREATED,
)
async def generate_beds(
    room_id: uuid.UUID, payload: BedGenerate, owner: RequireOwner, db: DbSession
) -> list[Bed]:
    """Guide 3.6's shortcut, for rooms that were not seeded at creation."""
    room, pg_id = await _pg_id_for_room(db, room_id)
    await ensure_pg_access(db, owner, pg_id)

    existing = list(
        await db.scalars(
            select(Bed).where(Bed.room_id == room_id).order_by(Bed.bed_label)
        )
    )
    target = payload.bed_count
    if target > room.total_beds:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Room "
            + room.room_number
            + " is declared with "
            + str(room.total_beds)
            + " bed(s). Increase its capacity before generating "
            + str(target)
            + ".",
        )
    if len(existing) >= target:
        return existing[:target]

    taken = {bed.bed_label for bed in existing}
    rent = payload.monthly_rent if payload.monthly_rent is not None else room.monthly_rent

    created: list[Bed] = []
    for label in BED_LABELS:
        if len(existing) + len(created) >= target:
            break
        if label in taken:
            continue
        bed = Bed(room_id=room_id, bed_label=label, monthly_rent=rent)
        db.add(bed)
        created.append(bed)

    await db.commit()
    for bed in created:
        await db.refresh(bed)
    return existing + created


@router.patch("/beds/{bed_id}", response_model=BedOut)
async def update_bed(
    bed_id: uuid.UUID, payload: BedUpdate, owner: RequireOwner, db: DbSession
) -> Bed:
    """Edit a bed's label or rent (guide 9: "Edit / view bed").

    Status changes go through PATCH /beds/{id}/status, which carries the rule
    that a bed only becomes occupied via tenant assignment.
    """
    bed, pg_id = await _pg_id_for_bed(db, bed_id)
    await ensure_pg_access(db, owner, pg_id)

    data = payload.model_dump(exclude_unset=True)
    if data.get("status") == BedStatus.OCCUPIED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A bed becomes occupied by assigning a tenant to it, not by setting "
            "its status directly. Tenant assignment arrives in Phase 2.",
        )

    if "bed_label" in data and data["bed_label"] != bed.bed_label:
        duplicate = await db.scalar(
            select(Bed.id).where(
                Bed.room_id == bed.room_id,
                Bed.bed_label == data["bed_label"],
                Bed.id != bed_id,
            )
        )
        if duplicate is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Bed '" + data["bed_label"] + "' already exists in this room",
            )

    for field, value in data.items():
        setattr(bed, field, value)
    await db.commit()
    await db.refresh(bed)
    return bed


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
        room_id=room_id,
        bed_label=payload.bed_label,
        # Guide 3.6: bed rent is an override; without one it inherits the room.
        monthly_rent=(
            payload.monthly_rent if payload.monthly_rent is not None else room.monthly_rent
        ),
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


@router.delete("/buildings/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_building(
    building_id: uuid.UUID, owner: RequireOwner, db: DbSession
) -> None:
    """Delete a building and everything under it.

    The floors, rooms and beds go with it through the schema's ON DELETE
    CASCADE -- that is deliberate, since a floor cannot exist without its
    building. The occupancy guard above is what stops that cascade from
    quietly deleting an occupied bed.
    """
    building, pg_id = await _pg_id_for_building(db, building_id)
    await ensure_pg_access(db, owner, pg_id)

    _refuse_if_occupied(
        await _occupied_beds_under(db, building_id=building_id), building.name
    )
    await db.delete(building)
    await db.commit()


@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_floor(floor_id: uuid.UUID, owner: RequireOwner, db: DbSession) -> None:
    floor, pg_id = await _pg_id_for_floor(db, floor_id)
    await ensure_pg_access(db, owner, pg_id)

    _refuse_if_occupied(
        await _occupied_beds_under(db, floor_id=floor_id), floor.floor_label
    )
    await db.delete(floor)
    await db.commit()


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(room_id: uuid.UUID, owner: RequireOwner, db: DbSession) -> None:
    room, pg_id = await _pg_id_for_room(db, room_id)
    await ensure_pg_access(db, owner, pg_id)

    _refuse_if_occupied(
        await _occupied_beds_under(db, room_id=room_id), f"Room {room.room_number}"
    )
    await db.delete(room)
    await db.commit()


@router.delete("/beds/{bed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bed(bed_id: uuid.UUID, owner: RequireOwner, db: DbSession) -> None:
    bed, pg_id = await _pg_id_for_bed(db, bed_id)
    await ensure_pg_access(db, owner, pg_id)

    if bed.status == BedStatus.OCCUPIED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Bed '{bed.bed_label}' is occupied. Move the tenant out before deleting it.",
        )
    await db.delete(bed)
    await db.commit()
