"""Test fixtures: a real Postgres test database, torn down between tests.

Deliberately not SQLite. The schema leans on Postgres-specific types (native
enums, UUID, TIMESTAMPTZ, gen_random_uuid) and the permission queries are real
SQL — testing against a different engine would prove the code works somewhere
it is never going to run.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path
import sys

import psycopg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

TEST_DB_NAME = "pgms_test"


def _url_for(database: str, *, async_driver: bool) -> str:
    base, _, _ = settings.database_url.rpartition("/")
    if not async_driver:
        base = base.replace("postgresql+asyncpg://", "postgresql://")
    return f"{base}/{database}"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def _create_test_database() -> None:
    admin_url = _url_for("postgres", async_driver=False)
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB_NAME,)
        ).fetchone()
        if exists is None:
            conn.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')


@pytest_asyncio.fixture
async def db_engine(_create_test_database) -> AsyncGenerator:
    engine = create_async_engine(_url_for(TEST_DB_NAME, async_driver=True))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(bind=db_engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    factory = async_sessionmaker(bind=db_engine, expire_on_commit=False, autoflush=False)

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ----------------------------------------------------------------- helpers


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def register_owner(
    client: AsyncClient,
    *,
    email: str = "owner@example.com",
    phone: str = "9876543210",
    full_name: str = "Amit Sharma",
    password: str = "OwnerPass123",
) -> dict:
    response = await client.post(
        "/auth/register",
        json={
            "full_name": full_name,
            "phone": phone,
            "email": email,
            "password": password,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def create_pg(client: AsyncClient, token: str, name: str, address: str, **overrides) -> dict:
    """Create a PG with the fields the Owner UI guide marks required.

    Callers pass name and address; everything else has a sane default so the
    tests that only care about "a PG exists" stay readable. Override any of it
    with keyword arguments.
    """
    body = {
        "name": name,
        "address": address,
        "pg_type": "co_living",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560034",
        "contact_phone": "9876543210",
    }
    body.update(overrides)
    response = await client.post("/pgs", json=body, headers=auth_headers(token))
    assert response.status_code == 201, response.text
    return response.json()


async def build_room_with_beds(
    client: AsyncClient,
    token: str,
    pg_id: str,
    *,
    room_number: str = "101",
    bed_labels: tuple[str, ...] = ("Bed A", "Bed B"),
) -> dict:
    """PG -> building -> floor -> room -> beds, the full nested chain."""
    headers = auth_headers(token)

    building = await client.post(
        f"/pgs/{pg_id}/buildings", json={"name": "Main Building"}, headers=headers
    )
    assert building.status_code == 201, building.text
    building_id = building.json()["id"]

    floor = await client.post(
        f"/buildings/{building_id}/floors",
        json={"floor_label": "1st Floor", "floor_order": 1},
        headers=headers,
    )
    assert floor.status_code == 201, floor.text
    floor_id = floor.json()["id"]

    room = await client.post(
        f"/floors/{floor_id}/rooms",
        json={
            "room_number": room_number,
            "room_type": "double",
            "total_beds": len(bed_labels),
            "monthly_rent": "8000.00",
            # This helper creates its beds explicitly below, so the room must
            # not seed its own -- otherwise the two collide on capacity.
            "generate_beds": False,
        },
        headers=headers,
    )
    assert room.status_code == 201, room.text
    room_id = room.json()["id"]

    beds = []
    for label in bed_labels:
        bed = await client.post(
            f"/rooms/{room_id}/beds",
            json={"bed_label": label, "monthly_rent": "8000.00"},
            headers=headers,
        )
        assert bed.status_code == 201, bed.text
        beds.append(bed.json())

    return {
        "building_id": building_id,
        "floor_id": floor_id,
        "room_id": room_id,
        "beds": beds,
    }
