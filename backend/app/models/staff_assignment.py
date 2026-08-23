from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at_col, uuid_pk

if TYPE_CHECKING:
    from app.models.property import PG
    from app.models.user import User


class StaffAssignment(Base):
    """Maps a staff user to a PG. PG mapping *only* — no permission columns.

    Every staff member gets the same fixed capability set (Product plan section
    2A); what varies per staff member is which PGs they can reach, and that is
    exactly what this table records. A `staff_permissions` table is deliberately
    absent and deferred to post-MVP.
    """

    __tablename__ = "staff_assignments"
    __table_args__ = (
        UniqueConstraint("staff_id", "pg_id"),
        Index("idx_staff_assignments_staff", "staff_id"),
        Index("idx_staff_assignments_pg", "pg_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    staff_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    pg_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("pgs.id", ondelete="CASCADE"), nullable=False
    )
    assigned_at: Mapped[datetime] = created_at_col()

    staff: Mapped["User"] = relationship(back_populates="staff_assignments")
    pg: Mapped["PG"] = relationship(back_populates="staff_assignments")
