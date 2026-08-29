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
    BuildingWithStructureOut,
    FloorOverviewOut,
    FloorWithBuildingOut,
    PGCreate,
    PGOut,
    PGRoomsOut,
    PGSummaryOut,
    PGUpdate,
    RoomOut,
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


def _summary(pg: PG, total: int, occupied: int, vacant: int, maintenance: int) -> PGSummaryOut:
    """Build the response from the ORM object rather than field by field.

    PGOut carries eleven columns now; writing them out at each of the four call
    sites is exactly how one endpoint quietly stops returning a new field.
    """
    return PGSummaryOut(
        **PGOut.model_validate(pg).model_dump(),
        total_beds=total,
        occupied_beds=occupied,
        vacant_beds=vacant,
        maintenance_beds=maintenance,
    )


@router.post("", response_model=PGSummaryOut, status_code=status.HTTP_201_CREATED)
async def create_pg(payload: PGCreate, owner: RequireOwner, db: DbSession) -> PGSummaryOut:
    pg = PG(owner_id=owner.id, **payload.model_dump())
    db.add(pg)
    await db.commit()
    await db.refresh(pg)
    return _summary(pg, 0, 0, 0, 0)


@router.get("", response_model=list[PGSummaryOut])
async def list_pgs(owner: RequireOwner, db: DbSession) -> list[PGSummaryOut]:
    """Every PG this owner owns — and only this owner's.

    The owner_id filter is the tenancy boundary for the whole product: a second
    owner hitting this endpoint sees their own PGs or nothing, never these.
    """
    rows = (await db.execute(_pg_with_counts_query().where(PG.owner_id == owner.id))).all()
    return [_summary(*row) for row in rows]


@router.patch("/{pg_id}", response_model=PGSummaryOut)
async def update_pg(
    payload: PGUpdate, pg: AccessiblePG, owner: RequireOwner, db: DbSession
) -> PGSummaryOut:
    # exclude_unset so "not sent" and "explicitly cleared to null" stay
    # distinguishable -- the Details tab edits a subset of fields at a time.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pg, field, value)
    await db.commit()

    row = (await db.execute(_pg_with_counts_query().where(PG.id == pg.id))).one()
    return _summary(*row)


@router.get("/{pg_id}", response_model=PGSummaryOut)
async def get_pg(pg: AccessiblePG, user: CurrentUser, db: DbSession) -> PGSummaryOut:
    """One PG with its bed counts -- the PG detail screen.

    Uses the same count expressions as the Properties list, so the detail page
    and the row it was opened from can never disagree.
    """
    row = (await db.execute(_pg_with_counts_query().where(PG.id == pg.id))).one()
    return _summary(*row)


@router.get("/{pg_id}/structure", response_model=list[BuildingWithStructureOut])
async def list_pg_structure(
    pg: AccessiblePG, user: CurrentUser, db: DbSession
) -> list[BuildingWithStructureOut]:
    """Buildings & Floors tab (guide 7): every building with its roll-up.

    Counts are computed in one grouped query rather than per building, so the
    tab costs a single round trip no matter how many buildings a PG has.
    """
    rows = (
        await db.execute(
            select(
                Building,
                func.count(func.distinct(Floor.id)).label("floor_count"),
                func.count(func.distinct(Room.id)).label("room_count"),
                func.count(Bed.id).label("bed_count"),
                func.count(Bed.id)
                .filter(Bed.status == BedStatus.OCCUPIED)
                .label("occupied_beds"),
            )
            .outerjoin(Floor, Floor.building_id == Building.id)
            .outerjoin(Room, Room.floor_id == Floor.id)
            .outerjoin(Bed, Bed.room_id == Room.id)
            .where(Building.pg_id == pg.id)
            .group_by(Building.id)
            .order_by(Building.created_at)
        )
    ).all()

    return [
        BuildingWithStructureOut(
            id=b.id,
            pg_id=b.pg_id,
            name=b.name,
            building_code=b.building_code,
            floor_count=floors,
            room_count=rooms,
            bed_count=beds,
            occupied_beds=occupied,
        )
        for b, floors, rooms, beds, occupied in rows
    ]


@router.get("/{pg_id}/floor-overview", response_model=list[FloorOverviewOut])
async def floor_overview(
    pg: AccessiblePG, user: CurrentUser, db: DbSession
) -> list[FloorOverviewOut]:
    """Guide 3.4: Floors Overview -- which floors are configured, which are not.

    A floor with zero rooms is "Not Configured" in the UI; that is read from
    room_count here rather than stored as a status, so it can never disagree
    with what is actually on the floor.
    """
    rows = (
        await db.execute(
            select(
                FloorModel,
                func.count(func.distinct(Room.id)).label("room_count"),
                func.count(Bed.id).label("bed_count"),
                func.count(Bed.id)
                .filter(Bed.status == BedStatus.OCCUPIED)
                .label("occupied_beds"),
                func.coalesce(func.sum(Bed.monthly_rent), 0).label("rent_total"),
            )
            .join(Building, FloorModel.building_id == Building.id)
            .outerjoin(Room, Room.floor_id == FloorModel.id)
            .outerjoin(Bed, Bed.room_id == Room.id)
            .where(Building.pg_id == pg.id)
            .group_by(FloorModel.id)
            .order_by(FloorModel.floor_order, FloorModel.floor_label)
        )
    ).all()

    return [
        FloorOverviewOut(
            id=f.id,
            building_id=f.building_id,
            floor_label=f.floor_label,
            floor_order=f.floor_order,
            room_count=rooms,
            bed_count=beds,
            occupied_beds=occupied,
            monthly_rent_total=rent_total,
        )
        for f, rooms, beds, occupied, rent_total in rows
    ]


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
    building = Building(
        pg_id=pg.id, name=payload.name, building_code=payload.building_code
    )
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
                **RoomOut.model_validate(room).model_dump(),
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


@router.delete("/{pg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pg(pg: AccessiblePG, owner: RequireOwner, db: DbSession) -> None:
    """Remove a PG and its whole structure.

    Buildings, floors, rooms, beds and staff assignments cascade away with it.
    The staff *accounts* do not: a staff member may work at several PGs, and
    deleting one property should never delete a person's login. They simply
    lose this assignment.
    """
    occupied = await db.scalar(
        select(func.count(Bed.id))
        .join(Room, Bed.room_id == Room.id)
        .join(Floor, Room.floor_id == Floor.id)
        .join(Building, Floor.building_id == Building.id)
        .where(Building.pg_id == pg.id, Bed.status == BedStatus.OCCUPIED)
    )
    if occupied:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{pg.name} still has {occupied} occupied bed(s). Move those tenants out "
            "before deleting the property.",
        )

    await db.delete(pg)
    await db.commit()
