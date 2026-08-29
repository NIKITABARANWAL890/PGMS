"""Deleting structure: PG, building, floor, room, bed.

Every delete refuses while a bed under it is occupied. No tenant can occupy a
bed until Phase 2, so these guards are cheap to write now and expensive to
retrofit later -- the tests pin the behaviour before that becomes true.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, build_room_with_beds, create_pg, register_owner

pytestmark = pytest.mark.asyncio


async def _pg_with_structure(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    built = await build_room_with_beds(client, token, pg["id"], bed_labels=("Bed A", "Bed B"))
    return token, pg, built


async def test_deleting_a_pg_removes_its_whole_structure(client: AsyncClient):
    token, pg, built = await _pg_with_structure(client)

    deleted = await client.delete(f"/pgs/{pg['id']}", headers=auth_headers(token))
    assert deleted.status_code == 204, deleted.text

    assert (await client.get(f"/pgs/{pg['id']}", headers=auth_headers(token))).status_code == 404
    # The cascade must take the children with it, not leave them orphaned.
    assert (
        await client.get(f"/rooms/{built['room_id']}/beds", headers=auth_headers(token))
    ).status_code == 404
    assert [p["id"] for p in (await client.get("/pgs", headers=auth_headers(token))).json()] == []


async def test_deleting_a_pg_keeps_the_staff_account(client: AsyncClient):
    """A staff member may work at several PGs; deleting one is not a sacking."""
    owner = await register_owner(client)
    token = owner["access_token"]
    doomed = await create_pg(client, token, "Sunrise PG", "Koramangala")
    kept = await create_pg(client, token, "Green Stay", "HSR")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [doomed["id"], kept["id"]],
        },
        headers=auth_headers(token),
    )
    password = created.json()["temporary_password"]

    assert (
        await client.delete(f"/pgs/{doomed['id']}", headers=auth_headers(token))
    ).status_code == 204

    login = await client.post(
        "/auth/login", json={"email": "ramesh@example.com", "password": password}
    )
    assert login.status_code == 200, "the staff account should survive"

    remaining = await client.get(
        "/staff/me/pgs", headers=auth_headers(login.json()["access_token"])
    )
    assert [p["id"] for p in remaining.json()] == [kept["id"]]


async def test_delete_refuses_while_a_bed_is_occupied(
    client: AsyncClient, db_session: AsyncSession
):
    token, pg, built = await _pg_with_structure(client)

    # No endpoint can set 'occupied' -- that is Phase 2's tenant assignment --
    # so the guard is exercised by setting the status directly.
    await db_session.execute(
        text("UPDATE beds SET status = 'occupied' WHERE id = :bed_id"),
        {"bed_id": built["beds"][0]["id"]},
    )
    await db_session.commit()

    for path in (
        f"/pgs/{pg['id']}",
        f"/buildings/{built['building_id']}",
        f"/floors/{built['floor_id']}",
        f"/rooms/{built['room_id']}",
        f"/beds/{built['beds'][0]['id']}",
    ):
        response = await client.delete(path, headers=auth_headers(token))
        assert response.status_code == 409, f"{path} should refuse: {response.text}"
        assert "occupied" in response.text.lower()

    # A vacant bed in the same room is still deletable.
    assert (
        await client.delete(
            f"/beds/{built['beds'][1]['id']}", headers=auth_headers(token)
        )
    ).status_code == 204


async def test_deleting_a_room_updates_the_pg_bed_counts(client: AsyncClient):
    token, pg, built = await _pg_with_structure(client)

    before = await client.get(f"/pgs/{pg['id']}", headers=auth_headers(token))
    assert before.json()["total_beds"] == 2

    assert (
        await client.delete(f"/rooms/{built['room_id']}", headers=auth_headers(token))
    ).status_code == 204

    after = await client.get(f"/pgs/{pg['id']}", headers=auth_headers(token))
    assert after.json()["total_beds"] == 0, "bed counts must follow the delete"


async def test_deleting_a_floor_leaves_its_siblings_alone(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main"}, headers=auth_headers(token)
    )
    floors = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 3},
        headers=auth_headers(token),
    )
    first, second = floors.json()[0]["id"], floors.json()[1]["id"]

    await client.post(
        f"/floors/{second}/rooms",
        json={
            "room_number": "201",
            "room_type": "double",
            "total_beds": 2,
            "monthly_rent": "8000.00",
        },
        headers=auth_headers(token),
    )

    assert (
        await client.delete(f"/floors/{first}", headers=auth_headers(token))
    ).status_code == 204

    remaining = await client.get(f"/pgs/{pg['id']}/floor-overview", headers=auth_headers(token))
    labels = [f["floor_label"] for f in remaining.json()]
    assert labels == ["Floor 2", "Floor 3"]
    assert next(f for f in remaining.json() if f["floor_label"] == "Floor 2")["room_count"] == 1


async def test_staff_cannot_delete_anything(client: AsyncClient):
    """Deletes are owner-only, even for a PG the staff member is assigned to."""
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    built = await build_room_with_beds(client, token, pg["id"], bed_labels=("Bed A",))

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [pg["id"]],
        },
        headers=auth_headers(token),
    )
    login = await client.post(
        "/auth/login",
        json={"email": "ramesh@example.com", "password": created.json()["temporary_password"]},
    )
    staff_headers = auth_headers(login.json()["access_token"])

    for path in (
        f"/pgs/{pg['id']}",
        f"/buildings/{built['building_id']}",
        f"/rooms/{built['room_id']}",
        f"/beds/{built['beds'][0]['id']}",
    ):
        assert (
            await client.delete(path, headers=staff_headers)
        ).status_code == 403, path


async def test_another_owner_cannot_delete_your_pg(client: AsyncClient):
    _, pg, _ = await _pg_with_structure(client)
    intruder = await register_owner(
        client, email="other@example.com", phone="9000000001", full_name="Other Owner"
    )
    denied = await client.delete(
        f"/pgs/{pg['id']}", headers=auth_headers(intruder["access_token"])
    )
    assert denied.status_code == 403
