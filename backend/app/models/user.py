from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at_col, updated_at_col, uuid_pk
from app.models.enums import UserRole, enum_values

if TYPE_CHECKING:
    from app.models.property import PG
    from app.models.refresh_token import RefreshToken
    from app.models.staff_assignment import StaffAssignment


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=enum_values),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Display label only ("Manager", "Housekeeping"). Deliberately a free-text
    # string, NOT a permission tier — every staff user gets the identical fixed
    # capability set regardless of what this says (Product plan section 2A).
    staff_title: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true", default=True
    )
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()

    owned_pgs: Mapped[list["PG"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    staff_assignments: Mapped[list["StaffAssignment"]] = relationship(
        back_populates="staff", cascade="all, delete-orphan"
    )
    # Convenience view of "which PGs is this staff member assigned to".
    staff_pgs: Mapped[list["PG"]] = relationship(
        secondary="staff_assignments",
        viewonly=True,
        order_by="PG.name",
    )
