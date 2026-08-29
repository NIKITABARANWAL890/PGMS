"""The PG -> Building -> Floor -> Room -> Bed hierarchy.

Bed is the inventory unit the whole product is built around (Product plan,
Module 1: "PGs earn money per occupied bed"), which is why occupancy is read
off `beds.status` rather than inferred from anything higher in the tree.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Text,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at_col, updated_at_col, uuid_pk
from app.models.enums import BedStatus, PGType, RoomType, enum_values

if TYPE_CHECKING:
    from app.models.staff_assignment import StaffAssignment
    from app.models.user import User


class PG(Base):
    __tablename__ = "pgs"
    __table_args__ = (Index("idx_pgs_owner", "owner_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    # Nullable in the database, required by the API on create. PGs that predate
    # these columns have no honest value to backfill -- inventing one would be
    # indistinguishable from something the owner actually entered.
    pg_type: Mapped[PGType | None] = mapped_column(
        SAEnum(PGType, name="pg_gender_type", values_callable=enum_values)
    )
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(10))
    contact_phone: Mapped[str | None] = mapped_column(String(15))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    pg_code: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()

    owner: Mapped["User"] = relationship(back_populates="owned_pgs")
    buildings: Mapped[list["Building"]] = relationship(
        back_populates="pg", cascade="all, delete-orphan"
    )
    staff_assignments: Mapped[list["StaffAssignment"]] = relationship(
        back_populates="pg", cascade="all, delete-orphan"
    )


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[uuid.UUID] = uuid_pk()
    pg_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pgs.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="Main Building"
    )
    building_code: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = created_at_col()

    pg: Mapped["PG"] = relationship(back_populates="buildings")
    floors: Mapped[list["Floor"]] = relationship(
        back_populates="building", cascade="all, delete-orphan"
    )


class Floor(Base):
    __tablename__ = "floors"

    id: Mapped[uuid.UUID] = uuid_pk()
    building_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    floor_label: Mapped[str] = mapped_column(String(50), nullable=False)
    floor_order: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    created_at: Mapped[datetime] = created_at_col()

    building: Mapped["Building"] = relationship(back_populates="floors")
    rooms: Mapped[list["Room"]] = relationship(
        back_populates="floor", cascade="all, delete-orphan"
    )


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("floor_id", "room_number"),
        CheckConstraint("total_beds > 0", name="rooms_total_beds_check"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    floor_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("floors.id", ondelete="CASCADE"), nullable=False
    )
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    room_type: Mapped[RoomType] = mapped_column(
        SAEnum(RoomType, name="room_type", values_callable=enum_values), nullable=False
    )
    total_beds: Mapped[int] = mapped_column(Integer, nullable=False)
    # Guide 3.6: a bed inherits this unless it carries its own rent.
    monthly_rent: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()

    floor: Mapped["Floor"] = relationship(back_populates="rooms")
    beds: Mapped[list["Bed"]] = relationship(
        back_populates="room", cascade="all, delete-orphan", order_by="Bed.bed_label"
    )


class Bed(Base):
    __tablename__ = "beds"
    __table_args__ = (
        UniqueConstraint("room_id", "bed_label"),
        Index("idx_beds_room", "room_id"),
        Index("idx_beds_status", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    room_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    bed_label: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[BedStatus] = mapped_column(
        SAEnum(BedStatus, name="bed_status", values_callable=enum_values),
        nullable=False,
        server_default=BedStatus.VACANT.value,
        default=BedStatus.VACANT,
    )
    # Nullable: a per-tenant rent override lands on tenants.monthly_rent in
    # Phase 2. This is the bed's list price.
    monthly_rent: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()

    room: Mapped["Room"] = relationship(back_populates="beds")
