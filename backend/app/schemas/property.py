from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import BedStatus, PGType, RoomType


# ---------------------------------------------------------------------- PGs
# Field-for-field from the Owner UI guide 3.1 (PG Details). Required there is
# required here; the guide's optional fields stay optional.
class PGCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    pg_type: PGType
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(min_length=4, max_length=10)
    contact_phone: str = Field(min_length=10, max_length=15)
    contact_email: EmailStr | None = None
    pg_code: str | None = Field(default=None, max_length=20)
    description: str | None = None


class PGUpdate(BaseModel):
    """Every field optional -- this backs the Details tab's Edit action, which
    is also how a PG created before these columns existed gets completed."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    pg_type: PGType | None = None
    address: str | None = Field(default=None, min_length=1, max_length=255)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    state: str | None = Field(default=None, min_length=1, max_length=100)
    pincode: str | None = Field(default=None, min_length=4, max_length=10)
    contact_phone: str | None = Field(default=None, min_length=10, max_length=15)
    contact_email: EmailStr | None = None
    pg_code: str | None = Field(default=None, max_length=20)
    description: str | None = None


class PGOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str
    pg_type: PGType | None
    city: str | None
    state: str | None
    pincode: str | None
    contact_phone: str | None
    contact_email: str | None
    pg_code: str | None
    description: str | None
    created_at: datetime


class PGSummaryOut(PGOut):
    """PGOut plus the bed counts the Properties table screen shows."""

    total_beds: int
    occupied_beds: int
    vacant_beds: int
    maintenance_beds: int


# ---------------------------------------------------------------- hierarchy
class BuildingCreate(BaseModel):
    name: str = Field(default="Main Building", min_length=1, max_length=100)
    building_code: str | None = Field(default=None, max_length=20)


class BuildingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    building_code: str | None = Field(default=None, max_length=20)


class BuildingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pg_id: uuid.UUID
    name: str
    building_code: str | None


class BuildingWithStructureOut(BuildingOut):
    """A building plus its roll-up, for the Buildings & Floors tab."""

    floor_count: int
    room_count: int
    bed_count: int
    occupied_beds: int


class FloorGenerate(BaseModel):
    """Guide 3.3: the owner gives a count, the system creates Floor 1..N.

    Floors are never created one at a time in the setup flow.
    """

    floor_count: int = Field(ge=1, le=50)


class FloorCreate(BaseModel):
    floor_label: str = Field(min_length=1, max_length=50)
    floor_order: int = 0


class FloorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    building_id: uuid.UUID
    floor_label: str
    floor_order: int


class FloorWithBuildingOut(FloorOut):
    """A floor plus the building it sits in.

    The "add a room" step needs to offer every floor in the PG in one list,
    and a bare floor label ("1st Floor") is ambiguous once a PG has more than
    one building -- so the building name travels with it.
    """

    building_name: str
    room_count: int


class FloorOverviewOut(FloorOut):
    """Guide 3.4: the Floors Overview list, showing what is configured yet."""

    room_count: int
    bed_count: int
    occupied_beds: int
    monthly_rent_total: Decimal


class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=20)
    room_type: RoomType
    total_beds: int = Field(gt=0)
    # Guide 3.5 marks rent required; beds inherit it unless overridden.
    monthly_rent: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    description: str | None = None
    # Guide 3.6's shortcut: create Bed A..N with the room in one call, so the
    # common case never needs a second trip to the bed form.
    generate_beds: bool = True


class RoomUpdate(BaseModel):
    room_number: str | None = Field(default=None, min_length=1, max_length=20)
    room_type: RoomType | None = None
    total_beds: int | None = Field(default=None, gt=0)
    monthly_rent: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    description: str | None = None


class BedCreate(BaseModel):
    bed_label: str = Field(min_length=1, max_length=20)
    monthly_rent: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class BedGenerate(BaseModel):
    """Guide 3.6's shortcut: a count in, Bed A / Bed B / Bed C out."""

    bed_count: int = Field(ge=1, le=26)
    monthly_rent: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class BedUpdate(BaseModel):
    bed_label: str | None = Field(default=None, min_length=1, max_length=20)
    status: BedStatus | None = None
    monthly_rent: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class BedStatusUpdate(BaseModel):
    status: BedStatus


class BedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    room_id: uuid.UUID
    bed_label: str
    status: BedStatus
    monthly_rent: Decimal | None


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    floor_id: uuid.UUID
    room_number: str
    room_type: RoomType
    total_beds: int
    monthly_rent: Decimal | None
    description: str | None


class RoomWithBedsOut(RoomOut):
    """One row of the Rooms & Beds screen: room, its beds, and its counts."""

    floor_label: str
    building_name: str
    beds: list[BedOut]
    occupied_beds: int
    vacant_beds: int
    maintenance_beds: int


class PGRoomsOut(BaseModel):
    pg_id: uuid.UUID
    pg_name: str
    total_beds: int
    occupied_beds: int
    vacant_beds: int
    maintenance_beds: int
    rooms: list[RoomWithBedsOut]
