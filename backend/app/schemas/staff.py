from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.property import PGOut


class StaffCreate(BaseModel):
    """Matches the 3-step Add Staff wireframe exactly: Basic Info -> Assign
    PG(s) -> Review & Add.

    There is deliberately no permissions field. Staff capability is fixed
    (Product plan section 2A); `staff_title` is a display label such as
    "Manager" or "Housekeeping" and carries no functional meaning.
    """

    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=10, max_length=15)
    email: EmailStr
    staff_title: str | None = Field(default=None, max_length=50)
    pg_ids: list[uuid.UUID] = Field(min_length=1)


class StaffUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    staff_title: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class StaffPGAssignmentUpdate(BaseModel):
    """Replaces the staff member's PG assignments with exactly this set."""

    pg_ids: list[uuid.UUID]


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str
    staff_title: str | None
    is_active: bool
    assigned_pgs: list[PGOut]


class StaffCreatedOut(StaffOut):
    """Returned once, on creation only.

    Staff do not self-register, so the account needs a credential the owner can
    hand over. This is the only time the password is ever readable — it is
    stored hashed and cannot be retrieved again.
    """

    temporary_password: str
