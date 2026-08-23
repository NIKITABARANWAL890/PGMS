"""Phase-1 enum types.

These mirror schema.sql exactly. Roles are a fixed enum on `users` rather than
a `roles` table — that is a deliberate decision (schema_notes.md section 1),
not an oversight: MVP roles are fixed, so a configurable table would model
flexibility that was explicitly deferred to post-MVP.

Only the enums used by the 8 Phase-1 tables are defined here. The other 12
enum types in schema.sql belong to Phases 2-6.
"""

import enum


class UserRole(str, enum.Enum):
    OWNER = "owner"
    STAFF = "staff"
    TENANT = "tenant"


class RoomType(str, enum.Enum):
    SINGLE = "single"
    DOUBLE = "double"
    TRIPLE = "triple"
    SHARING = "sharing"


class BedStatus(str, enum.Enum):
    # 'maintenance' is a first-class state, not a derived one — the Staff
    # wireframe's "Rooms Needing Attention" panel shows it separately from
    # occupied/vacant.
    OCCUPIED = "occupied"
    VACANT = "vacant"
    MAINTENANCE = "maintenance"


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """For SQLAlchemy's values_callable, so Postgres stores 'owner', not 'OWNER'."""
    return [member.value for member in enum_cls]
