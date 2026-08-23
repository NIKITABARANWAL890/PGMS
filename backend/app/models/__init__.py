"""Phase-1 models only — the 8 in-scope tables.

Tenants, billing, complaints, move-outs, notices and notifications exist in
schema.sql but belong to Phases 2-6 and are deliberately not modelled yet:
migrating tables nothing queries is wasted motion (phase1_tasks.md section 2).
"""

from app.db.base import Base
from app.models.enums import BedStatus, RoomType, UserRole
from app.models.property import PG, Bed, Building, Floor, Room
from app.models.refresh_token import RefreshToken
from app.models.staff_assignment import StaffAssignment
from app.models.user import User

__all__ = [
    "Base",
    "Bed",
    "BedStatus",
    "Building",
    "Floor",
    "PG",
    "RefreshToken",
    "Room",
    "RoomType",
    "StaffAssignment",
    "User",
    "UserRole",
]
