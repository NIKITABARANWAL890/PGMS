from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BedStatus, RoomType


# ---------------------------------------------------------------------- PGs
class PGCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=1, max_length=255)


class PGUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    address: str | None = Field(default=None, min_length=1, max_length=255)


class PGOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str


class PGSummaryOut(PGOut):
    """PGOut plus the bed counts the Properties table screen shows."""

    total_beds: int
    occupied_beds: int
    vacant_beds: int
    maintenance_beds: int


# ---------------------------------------------------------------- hierarchy
class BuildingCreate(BaseModel):
    name: str = Field(default="Main Building", min_length=1, max_length=100)


class BuildingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pg_id: uuid.UUID
    name: str


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


class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=20)
    room_type: RoomType
    total_beds: int = Field(gt=0)


class BedCreate(BaseModel):
    bed_label: str = Field(min_length=1, max_length=20)
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
