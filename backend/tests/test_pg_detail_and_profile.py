"""Coverage for the endpoints added for PG detail, floor listing and profile.

These close three gaps found while using the app: a PG had no detail view,
floors could be created but never read back, and a staff member handed a
generated password had no way to change it.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import (
    auth_headers,
    build_room_with_beds,
    create_pg,
    register_owner,
)

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------- PG detail
async def test_pg_detail_matches_the_list_row(client: AsyncClient):
    """The detail page and the row it was opened from must agree.

    They are separate queries, so this is exactly the kind of pair that drifts
    silently once someone edits one of them.
    """
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    await build_room_with_beds(client, token, pg["id"], bed_labels=("Bed A", "Bed B"))

    detail = await client.get(f"/pgs/{pg['id']}", headers=auth_headers(token))
    assert detail.status_code == 200, detail.text

    listed = await client.get("/pgs", headers=auth_headers(token))
    row = next(p for p in listed.json() if p["id"] == pg["id"])

    assert detail.json() == row


async def test_pg_detail_is_scoped_to_the_owner(client: AsyncClient):
    first = await register_owner(client)
    pg = await create_pg(client, first["access_token"], "Sunrise PG", "Koramangala")

    second = await register_owner(
        client, email="other@example.com", phone="9000000001", full_name="Other Owner"
    )
    denied = await client.get(
        f"/pgs/{pg['id']}", headers=auth_headers(second["access_token"])
    )
    assert denied.status_code == 403


# ------------------------------------------------------------ floor listing
async def test_floors_can_be_read_back_after_creation(client: AsyncClient):
    """The bug this endpoint fixes: floors were write-only.

    Without a GET, a "choose a floor" control can only remember floors created
    in the current browser session, so a reload appears to lose them even though
    they were saved correctly.
    """
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")

    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Block A"}, headers=auth_headers(token)
    )
    building_id = building.json()["id"]

    for label, order in (("2nd Floor", 2), ("1st Floor", 1)):
        created = await client.post(
            f"/buildings/{building_id}/floors",
            json={"floor_label": label, "floor_order": order},
            headers=auth_headers(token),
        )
        assert created.status_code == 201

    pg_floors = await client.get(f"/pgs/{pg['id']}/floors", headers=auth_headers(token))
    assert pg_floors.status_code == 200, pg_floors.text
    labels = [f["floor_label"] for f in pg_floors.json()]
    assert labels == ["1st Floor", "2nd Floor"], "floors should come back in floor_order"
    assert all(f["building_name"] == "Block A" for f in pg_floors.json())
    assert all(f["room_count"] == 0 for f in pg_floors.json())

    building_floors = await client.get(
        f"/buildings/{building_id}/floors", headers=auth_headers(token)
    )
    assert building_floors.status_code == 200
    assert len(building_floors.json()) == 2


async def test_pg_floors_span_buildings_and_count_rooms(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")

    # A second building makes a bare floor label ambiguous, which is why the
    # response carries the building name.
    for building_name in ("Block A", "Block B"):
        building = await client.post(
            f"/pgs/{pg['id']}/buildings",
            json={"name": building_name},
            headers=auth_headers(token),
        )
        floor = await client.post(
            f"/buildings/{building.json()['id']}/floors",
            json={"floor_label": "1st Floor", "floor_order": 1},
            headers=auth_headers(token),
        )
        if building_name == "Block A":
            await client.post(
                f"/floors/{floor.json()['id']}/rooms",
                json={
                    "room_number": "101",
                    "room_type": "double",
                    "total_beds": 2,
                    "monthly_rent": "8000.00",
                },
                headers=auth_headers(token),
            )

    floors = await client.get(f"/pgs/{pg['id']}/floors", headers=auth_headers(token))
    by_building = {f["building_name"]: f for f in floors.json()}
    assert set(by_building) == {"Block A", "Block B"}
    assert by_building["Block A"]["room_count"] == 1
    assert by_building["Block B"]["room_count"] == 0


async def test_staff_cannot_list_floors_of_an_unassigned_pg(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    assigned = await create_pg(client, token, "Sunrise PG", "Koramangala")
    unassigned = await create_pg(client, token, "Comfort Living", "Indiranagar")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [assigned["id"]],
        },
        headers=auth_headers(token),
    )
    login = await client.post(
        "/auth/login",
        json={
            "email": "ramesh@example.com",
            "password": created.json()["temporary_password"],
        },
    )
    staff_headers = auth_headers(login.json()["access_token"])

    assert (
        await client.get(f"/pgs/{assigned['id']}/floors", headers=staff_headers)
    ).status_code == 200
    # Same rule as every other PG-scoped route -- a new endpoint must not open
    # a new way around the assignment check.
    assert (
        await client.get(f"/pgs/{unassigned['id']}/floors", headers=staff_headers)
    ).status_code == 403
    assert (
        await client.get(f"/pgs/{unassigned['id']}", headers=staff_headers)
    ).status_code == 403


# ------------------------------------------------------------------ profile
async def test_owner_can_edit_their_own_profile(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]

    updated = await client.patch(
        "/auth/me",
        json={"full_name": "Amit K. Sharma", "phone": "9998887770"},
        headers=auth_headers(token),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["full_name"] == "Amit K. Sharma"
    assert updated.json()["phone"] == "9998887770"

    me = await client.get("/auth/me", headers=auth_headers(token))
    assert me.json()["full_name"] == "Amit K. Sharma"


async def test_profile_edit_cannot_steal_another_users_email(client: AsyncClient):
    first = await register_owner(client)
    await register_owner(
        client, email="taken@example.com", phone="9000000001", full_name="Other Owner"
    )

    clash = await client.patch(
        "/auth/me",
        json={"email": "taken@example.com"},
        headers=auth_headers(first["access_token"]),
    )
    assert clash.status_code == 409


async def test_profile_edit_cannot_change_role(client: AsyncClient):
    """Role is not a self-service field -- nobody promotes themselves."""
    owner = await register_owner(client)
    response = await client.patch(
        "/auth/me",
        json={"full_name": "Amit", "role": "staff"},
        headers=auth_headers(owner["access_token"]),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "owner"


async def test_staff_can_change_their_temporary_password(client: AsyncClient):
    """The gap this closes: staff never chose the password they were given."""
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")

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
    temp_password = created.json()["temporary_password"]

    login = await client.post(
        "/auth/login", json={"email": "ramesh@example.com", "password": temp_password}
    )
    staff_headers = auth_headers(login.json()["access_token"])

    wrong = await client.post(
        "/auth/change-password",
        json={"current_password": "not-it", "new_password": "MyOwnPass123"},
        headers=staff_headers,
    )
    assert wrong.status_code == 400

    changed = await client.post(
        "/auth/change-password",
        json={"current_password": temp_password, "new_password": "MyOwnPass123"},
        headers=staff_headers,
    )
    assert changed.status_code == 204, changed.text

    assert (
        await client.post(
            "/auth/login",
            json={"email": "ramesh@example.com", "password": temp_password},
        )
    ).status_code == 401
    assert (
        await client.post(
            "/auth/login",
            json={"email": "ramesh@example.com", "password": "MyOwnPass123"},
        )
    ).status_code == 200


async def test_changing_password_revokes_outstanding_refresh_tokens(client: AsyncClient):
    """A password change should end sessions opened with the old password."""
    owner = await register_owner(client)
    old_refresh = owner["refresh_token"]

    changed = await client.post(
        "/auth/change-password",
        json={"current_password": "OwnerPass123", "new_password": "BrandNewPass456"},
        headers=auth_headers(owner["access_token"]),
    )
    assert changed.status_code == 204

    replay = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert replay.status_code == 401, "the old session must not survive a password change"


async def test_change_password_rejects_a_too_short_password(client: AsyncClient):
    owner = await register_owner(client)
    response = await client.post(
        "/auth/change-password",
        json={"current_password": "OwnerPass123", "new_password": "short"},
        headers=auth_headers(owner["access_token"]),
    )
    assert response.status_code == 422
