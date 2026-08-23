"""PG create/list/edit, and the Rooms & Beds read model."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import AccessiblePG, CurrentUser, DbSession, RequireOwner
from app.models.enums import BedStatus
from app.models.property import PG, Bed, Building, Floor, Room
from app.models.property import Floor as FloorModel
from app.schemas.property import (
    BedOut,
    BuildingCreate,
    BuildingOut,
    FloorWithBuildingOut,
    PGCreate,
    PGRoomsOut,
    PGSummaryOut,
    PGUpdate,
    RoomWithBedsOut,
)

router = APIRouter(prefix="/pgs", tags=["pgs"])


def _bed_count_columns() -> list:
    """Occupancy counts, derived from beds.status — never stored separately.

    Every screen that shows occupancy reads these same expressions, so the
    Properties table and the Rooms & Beds screen cannot drift apart the way two
    hand-maintained counters would.
    """
    return [
        func.count(Bed.id).label("total_beds"),
        func.count(Bed.id).filter(Bed.status == BedStatus.OCCUPIED).label("occupied_beds"),
        func.count(Bed.id).filter(Bed.status == BedStatus.VACANT).label("vacant_beds"),
        func.count(Bed.id)
        .filter(Bed.status == BedStatus.MAINTENANCE)
        .label("maintenance_beds"),
    ]


def _pg_with_counts_query() -> Select:
    return (
        select(PG, *_bed_count_columns())
        .outerjoin(Building, Building.pg_id == PG.id)
        .outerjoin(Floor, Floor.building_id == Building.id)
        .outerjoin(Room, Room.floor_id == Floor.id)
        .outerjoin(Bed, Bed.room_id == Room.id)
        .group_by(PG.id)
        .order_by(PG.created_at)
    )


@router.post("", response_model=PGSummaryOut, status_code=status.HTTP_201_CREATED)
async def create_pg(payload: PGCreate, owner: RequireOwner, db: DbSession) -> PGSummaryOut:
    pg = PG(owner_id=owner.id, name=payload.name, address=payload.address)
    db.add(pg)
    await db.commit()
    await db.refresh(pg)
    return PGSummaryOut(
        id=pg.id,
        name=pg.name,
        address=pg.address,
        total_beds=0,
        occupied_beds=0,
        vacant_beds=0,
        maintenance_beds=0,
    )


@router.get("", response_model=list[PGSummaryOut])
async def list_pgs(owner: RequireOwner, db: DbSession) -> list[PGSummaryOut]:
    """Every PG this owner owns — and only this owner's.

    The owner_id filter is the tenancy boundary for the whole product: a second
    owner hitting this endpoint sees their own PGs or nothing, never these.
    """
    rows = (await db.execute(_pg_with_counts_query().where(PG.owner_id == owner.id))).all()
    return [
        PGSummaryOut(
            id=pg.id,
            name=pg.name,
            address=pg.address,
            total_beds=total,
            occupied_beds=occupied,
            vacant_beds=vacant,
            maintenance_beds=maintenance,
        )
        for pg, total, occupied, vacant, maintenance in rows
    ]


@router.patch("/{pg_id}", response_model=PGSummaryOut)
async def update_pg(
    payload: PGUpdate, pg: AccessiblePG, owner: RequireOwner, db: DbSession
) -> PGSummaryOut:
    if payload.name is not None:
        pg.name = payload.name
    if payload.address is not None:
        pg.address = payload.address
    await db.commit()

    row = (
        await db.execute(_pg_with_counts_query().where(PG.id == pg.id))
    ).one()
    updated, total, occupied, vacant, maintenance = row
    return PGSummaryOut(
        id=updated.id,
        name=updated.name,
        address=updated.address,
        total_beds=total,
        occupied_beds=occupied,
        vacant_beds=vacant,
        maintenance_beds=maintenance,
    )


@router.get("/{pg_id}", response_model=PGSummaryOut)
async def get_pg(pg: AccessiblePG, user: CurrentUser, db: DbSession) -> PGSummaryOut:
    """One PG with its bed counts -- the PG detail screen.

    Uses the same count expressions as the Properties list, so the detail page
    and the row it was opened from can never disagree.
    """
    row = (await db.execute(_pg_with_counts_query().where(PG.id == pg.id))).one()
    found, total, occupied, vacant, maintenance = row
    return PGSummaryOut(
        id=found.id,
        name=found.name,
        address=found.address,
        total_beds=total,
        occupied_beds=occupied,
        vacant_beds=vacant,
        maintenance_beds=maintenance,
    )


@router.get("/{pg_id}/floors", response_model=list[FloorWithBuildingOut])
async def list_pg_floors(
    pg: AccessiblePG, user: CurrentUser, db: DbSession
) -> list[FloorWithBuildingOut]:
    """Every floor in this PG, across all its buildings.

    This is what makes floors durable in the UI. Without a way to read floors
    back, a "pick a floor" control can only offer floors created in the current
    browser session -- so a page reload would appear to lose them, even though
    they were saved correctly.
    """
    rows = (
        await db.execute(
            select(
                FloorModel,
                Building.name,
                func.count(Room.id).label("room_count"),
            )
            .join(Building, FloorModel.building_id == Building.id)
            .outerjoin(Room, Room.floor_id == FloorModel.id)
            .where(Building.pg_id == pg.id)
            .group_by(FloorModel.id, Building.name)
            .order_by(Building.name, FloorModel.floor_order, FloorModel.floor_label)
        )
    ).all()

    return [
        FloorWithBuildingOut(
            id=floor.id,
            building_id=floor.building_id,
            floor_label=floor.floor_label,
            floor_order=floor.floor_order,
            building_name=building_name,
            room_count=room_count,
        )
        for floor, building_name, room_count in rows
    ]


@router.post(
    "/{pg_id}/buildings", response_model=BuildingOut, status_code=status.HTTP_201_CREATED
)
async def create_building(
    payload: BuildingCreate, pg: AccessiblePG, owner: RequireOwner, db: DbSession
) -> Building:
    building = Building(pg_id=pg.id, name=payload.name)
    db.add(building)
    await db.commit()
    await db.refresh(building)
    return building


@router.get("/{pg_id}/buildings", response_model=list[BuildingOut])
async def list_buildings(pg: AccessiblePG, user: CurrentUser, db: DbSession) -> list[Building]:
    result = await db.scalars(
        select(Building).where(Building.pg_id == pg.id).order_by(Building.created_at)
    )
    return list(result)


@router.get("/{pg_id}/rooms", response_model=PGRoomsOut)
async def list_pg_rooms(pg: AccessiblePG, user: CurrentUser, db: DbSession) -> PGRoomsOut:
    """The Rooms & Beds screen, in one call.

    Reached by owners and by staff assigned to this PG. Staff who are *not*
    assigned never get here — get_accessible_pg refuses with 403 first.
    """
    rooms = list(
        await db.scalars(
            select(Room)
            .join(Floor, Room.floor_id == Floor.id)
            .join(Building, Floor.building_id == Building.id)
            .where(Building.pg_id == pg.id)
            .options(
                selectinload(Room.beds),
                selectinload(Room.floor).selectinload(Floor.building),
            )
            .order_by(Floor.floor_order, Room.room_number)
        )
    )

    room_rows: list[RoomWithBedsOut] = []
    totals = {"total": 0, "occupied": 0, "vacant": 0, "maintenance": 0}

    for room in rooms:
        occupied = sum(1 for b in room.beds if b.status == BedStatus.OCCUPIED)
        vacant = sum(1 for b in room.beds if b.status == BedStatus.VACANT)
        maintenance = sum(1 for b in room.beds if b.status == BedStatus.MAINTENANCE)

        totals["total"] += len(room.beds)
        totals["occupied"] += occupied
        totals["vacant"] += vacant
        totals["maintenance"] += maintenance

        room_rows.append(
            RoomWithBedsOut(
                id=room.id,
                floor_id=room.floor_id,
                room_number=room.room_number,
                room_type=room.room_type,
                total_beds=room.total_beds,
                floor_label=room.floor.floor_label,
                building_name=room.floor.building.name,
                beds=[BedOut.model_validate(b) for b in room.beds],
                occupied_beds=occupied,
                vacant_beds=vacant,
                maintenance_beds=maintenance,
            )
        )

    return PGRoomsOut(
        pg_id=pg.id,
        pg_name=pg.name,
        total_beds=totals["total"],
        occupied_beds=totals["occupied"],
        vacant_beds=totals["vacant"],
        maintenance_beds=totals["maintenance"],
        rooms=room_rows,
    )
