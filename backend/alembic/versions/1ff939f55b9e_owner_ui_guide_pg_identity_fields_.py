"""owner ui guide: pg identity fields, building code, room rent

Adds the columns the Owner UI guide's PG Details (3.1), Building (3.2) and
Room (3.5) steps collect.

Every column is nullable. The guide marks most of them required, and the API
enforces that on create -- but rows written before this migration have no
honest value to backfill. Defaulting every existing PG to "co_living" would
put data in front of the owner that they never entered and cannot tell apart
from their own input. A blank that the Details tab prompts them to fill is the
truthful representation.

Revision ID: 1ff939f55b9e
Revises: cb7dbf0846e2
Create Date: 2026-08-25 21:55:53.141983
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "1ff939f55b9e"
down_revision: Union[str, None] = "cb7dbf0846e2"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


# Declared once and reused. `create_type=False` stops add_column from trying to
# emit CREATE TYPE itself -- autogenerate left that out entirely, which would
# have failed on any database that did not already have the type.
#
# Named pg_gender_type rather than pg_type on purpose: PostgreSQL ships a
# system catalog type called pg_type, and creating one with the same name in
# `public` shadows it. SQLAlchemy's checkfirst looks enums up by bare name, so
# the collision made it see the catalog's entry and skip creating ours -- which
# surfaced as "type already exists" on the next upgrade.
pg_type_enum = postgresql.ENUM(
    "girls", "boys", "co_living", name="pg_gender_type", create_type=False
)


def upgrade() -> None:
    pg_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("pgs", sa.Column("pg_type", pg_type_enum, nullable=True))
    op.add_column("pgs", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("pgs", sa.Column("state", sa.String(length=100), nullable=True))
    op.add_column("pgs", sa.Column("pincode", sa.String(length=10), nullable=True))
    op.add_column("pgs", sa.Column("contact_phone", sa.String(length=15), nullable=True))
    op.add_column("pgs", sa.Column("contact_email", sa.String(length=255), nullable=True))
    op.add_column("pgs", sa.Column("pg_code", sa.String(length=20), nullable=True))
    op.add_column("pgs", sa.Column("description", sa.Text(), nullable=True))

    op.add_column(
        "buildings", sa.Column("building_code", sa.String(length=20), nullable=True)
    )

    op.add_column(
        "rooms", sa.Column("monthly_rent", sa.Numeric(precision=10, scale=2), nullable=True)
    )
    op.add_column("rooms", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "description")
    op.drop_column("rooms", "monthly_rent")
    op.drop_column("buildings", "building_code")
    op.drop_column("pgs", "description")
    op.drop_column("pgs", "pg_code")
    op.drop_column("pgs", "contact_email")
    op.drop_column("pgs", "contact_phone")
    op.drop_column("pgs", "pincode")
    op.drop_column("pgs", "state")
    op.drop_column("pgs", "city")
    op.drop_column("pgs", "pg_type")

    # Dropped last: the type cannot go while a column still uses it. Without
    # this, downgrade-then-upgrade fails on "type already exists".
    pg_type_enum.drop(op.get_bind(), checkfirst=True)
