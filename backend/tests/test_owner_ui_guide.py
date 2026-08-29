"""The setup flow described in the Owner UI guide.

Each test names the guide section it covers, so a failure points at the spec
paragraph it broke rather than just at a line of code.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, create_pg, register_owner

pytestmark = pytest.mark.asyncio


async def _owner(client: AsyncClient) -> str:
    return (await register_owner(client))["access_token"]


# ------------------------------------------------- 3.1 PG Details
async def test_pg_carries_every_identity_field(client: AsyncClient):
    token = await _owner(client)

    created = await client.post(
        "/pgs",
        json={
            "name": "Sunrise PG",
            "pg_type": "boys",
            "address": "24th Main, Koramangala",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560034",
            "contact_phone": "9876543210",
            "contact_email": "sunrise@example.com",
            "pg_code": "SPG001",
            "description": "Near metro, fully furnished",
        },
        headers=auth_headers(token),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["pg_type"] == "boys"
    assert body["city"] == "Bengaluru"
    assert body["pincode"] == "560034"
    assert body["pg_code"] == "SPG001"

    # The Details tab reads these back from the detail endpoint.
    detail = await client.get(f"/pgs/{body['id']}", headers=auth_headers(token))
    assert detail.json()["contact_email"] == "sunrise@example.com"
    assert detail.json()["description"] == "Near metro, fully furnished"


async def test_required_pg_fields_are_actually_required(client: AsyncClient):
    token = await _owner(client)
    incomplete = await client.post(
        "/pgs",
        json={"name": "Sunrise PG", "address": "24th Main"},
        headers=auth_headers(token),
    )
    assert incomplete.status_code == 422


async def test_pg_details_can_be_edited_field_by_field(client: AsyncClient):
    """Details tab "Edit" sends a subset; untouched fields must survive."""
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main", pg_code="SPG001")

    edited = await client.patch(
        f"/pgs/{pg['id']}",
        json={"description": "Wi-Fi and meals included"},
        headers=auth_headers(token),
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["description"] == "Wi-Fi and meals included"
    assert edited.json()["pg_code"] == "SPG001", "an untouched field was wiped"
    assert edited.json()["city"] == "Bengaluru"


# ------------------------------------------- 3.2 Building / single vs multiple
async def test_building_carries_an_optional_code(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")

    created = await client.post(
        f"/pgs/{pg['id']}/buildings",
        json={"name": "Main Building", "building_code": "MB-01"},
        headers=auth_headers(token),
    )
    assert created.status_code == 201, created.text
    assert created.json()["building_code"] == "MB-01"

    renamed = await client.patch(
        f"/buildings/{created.json()['id']}",
        json={"name": "Block A"},
        headers=auth_headers(token),
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Block A"
    assert renamed.json()["building_code"] == "MB-01"


# ------------------------------------------------- 3.3 Number of Floors
async def test_floor_count_generates_floor_1_to_n(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main Building"}, headers=auth_headers(token)
    )

    generated = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 4},
        headers=auth_headers(token),
    )
    assert generated.status_code == 201, generated.text
    assert [f["floor_label"] for f in generated.json()] == [
        "Floor 1",
        "Floor 2",
        "Floor 3",
        "Floor 4",
    ]
    assert [f["floor_order"] for f in generated.json()] == [1, 2, 3, 4]


async def test_generating_more_floors_is_additive_not_destructive(client: AsyncClient):
    """Raising the count must not delete rooms already configured below it."""
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main Building"}, headers=auth_headers(token)
    )
    building_id = building.json()["id"]

    first = await client.post(
        f"/buildings/{building_id}/floors/generate",
        json={"floor_count": 2},
        headers=auth_headers(token),
    )
    floor_one_id = first.json()[0]["id"]

    await client.post(
        f"/floors/{floor_one_id}/rooms",
        json={
            "room_number": "101",
            "room_type": "double",
            "total_beds": 2,
            "monthly_rent": "8000.00",
        },
        headers=auth_headers(token),
    )

    grown = await client.post(
        f"/buildings/{building_id}/floors/generate",
        json={"floor_count": 4},
        headers=auth_headers(token),
    )
    assert len(grown.json()) == 4
    assert grown.json()[0]["id"] == floor_one_id, "Floor 1 was recreated, not kept"

    rooms = await client.get(f"/floors/{floor_one_id}/rooms", headers=auth_headers(token))
    assert len(rooms.json()) == 1, "the configured room did not survive"


# ------------------------------------------------- 3.4 Floors Overview
async def test_floor_overview_distinguishes_configured_from_not(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main Building"}, headers=auth_headers(token)
    )
    floors = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 3},
        headers=auth_headers(token),
    )
    second_floor = floors.json()[1]["id"]

    await client.post(
        f"/floors/{second_floor}/rooms",
        json={
            "room_number": "201",
            "room_type": "triple",
            "total_beds": 3,
            "monthly_rent": "6000.00",
        },
        headers=auth_headers(token),
    )

    overview = await client.get(
        f"/pgs/{pg['id']}/floor-overview", headers=auth_headers(token)
    )
    assert overview.status_code == 200, overview.text
    rows = {r["floor_label"]: r for r in overview.json()}

    # "Not Configured" in the UI is room_count == 0, read live rather than stored.
    assert rows["Floor 1"]["room_count"] == 0
    assert rows["Floor 2"]["room_count"] == 1
    assert rows["Floor 2"]["bed_count"] == 3
    assert rows["Floor 3"]["room_count"] == 0


# ------------------------------------------------- 3.5 / 3.6 Rooms and Beds
async def test_creating_a_room_seeds_its_beds(client: AsyncClient):
    """Guide 3.6's shortcut: a bed count in, Bed A / Bed B / Bed C out."""
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main Building"}, headers=auth_headers(token)
    )
    floors = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 1},
        headers=auth_headers(token),
    )

    room = await client.post(
        f"/floors/{floors.json()[0]['id']}/rooms",
        json={
            "room_number": "201",
            "room_type": "triple",
            "total_beds": 3,
            "monthly_rent": "8000.00",
            "description": "AC, attached bathroom",
        },
        headers=auth_headers(token),
    )
    assert room.status_code == 201, room.text
    assert room.json()["monthly_rent"] == "8000.00"
    assert room.json()["description"] == "AC, attached bathroom"

    beds = await client.get(
        f"/rooms/{room.json()['id']}/beds", headers=auth_headers(token)
    )
    assert [b["bed_label"] for b in beds.json()] == ["Bed A", "Bed B", "Bed C"]
    # Guide 3.6: bed rent inherits the room's unless overridden.
    assert all(b["monthly_rent"] == "8000.00" for b in beds.json())


async def test_bed_rent_overrides_the_room_rent(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main"}, headers=auth_headers(token)
    )
    floors = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 1},
        headers=auth_headers(token),
    )
    room = await client.post(
        f"/floors/{floors.json()[0]['id']}/rooms",
        json={
            "room_number": "301",
            "room_type": "double",
            "total_beds": 2,
            "monthly_rent": "8000.00",
            "generate_beds": False,
        },
        headers=auth_headers(token),
    )
    room_id = room.json()["id"]

    inherited = await client.post(
        f"/rooms/{room_id}/beds", json={"bed_label": "Bed A"}, headers=auth_headers(token)
    )
    assert inherited.json()["monthly_rent"] == "8000.00"

    overridden = await client.post(
        f"/rooms/{room_id}/beds",
        json={"bed_label": "Bed B", "monthly_rent": "9500.00"},
        headers=auth_headers(token),
    )
    assert overridden.json()["monthly_rent"] == "9500.00"


async def test_generate_beds_respects_declared_capacity(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main"}, headers=auth_headers(token)
    )
    floors = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 1},
        headers=auth_headers(token),
    )
    room = await client.post(
        f"/floors/{floors.json()[0]['id']}/rooms",
        json={
            "room_number": "401",
            "room_type": "double",
            "total_beds": 2,
            "monthly_rent": "8000.00",
            "generate_beds": False,
        },
        headers=auth_headers(token),
    )
    room_id = room.json()["id"]

    too_many = await client.post(
        f"/rooms/{room_id}/beds/generate",
        json={"bed_count": 5},
        headers=auth_headers(token),
    )
    assert too_many.status_code == 409, "capacity must be enforced, not silently exceeded"

    ok = await client.post(
        f"/rooms/{room_id}/beds/generate",
        json={"bed_count": 2},
        headers=auth_headers(token),
    )
    assert ok.status_code == 201
    assert [b["bed_label"] for b in ok.json()] == ["Bed A", "Bed B"]

    # Re-running must not duplicate — generation is idempotent up to the count.
    again = await client.post(
        f"/rooms/{room_id}/beds/generate",
        json={"bed_count": 2},
        headers=auth_headers(token),
    )
    assert len(again.json()) == 2
    beds = await client.get(f"/rooms/{room_id}/beds", headers=auth_headers(token))
    assert len(beds.json()) == 2


async def test_room_capacity_cannot_drop_below_existing_beds(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")
    building = await client.post(
        f"/pgs/{pg['id']}/buildings", json={"name": "Main"}, headers=auth_headers(token)
    )
    floors = await client.post(
        f"/buildings/{building.json()['id']}/floors/generate",
        json={"floor_count": 1},
        headers=auth_headers(token),
    )
    room = await client.post(
        f"/floors/{floors.json()[0]['id']}/rooms",
        json={
            "room_number": "501",
            "room_type": "triple",
            "total_beds": 3,
            "monthly_rent": "7000.00",
        },
        headers=auth_headers(token),
    )

    shrink = await client.patch(
        f"/rooms/{room.json()['id']}",
        json={"total_beds": 1},
        headers=auth_headers(token),
    )
    assert shrink.status_code == 409


# ------------------------------------------------- 7. Buildings & Floors tab
async def test_structure_endpoint_rolls_up_per_building(client: AsyncClient):
    token = await _owner(client)
    pg = await create_pg(client, token, "Sunrise PG", "24th Main")

    for name, floor_count, rooms in (("Block A", 2, 2), ("Block B", 1, 0)):
        building = await client.post(
            f"/pgs/{pg['id']}/buildings", json={"name": name}, headers=auth_headers(token)
        )
        floors = await client.post(
            f"/buildings/{building.json()['id']}/floors/generate",
            json={"floor_count": floor_count},
            headers=auth_headers(token),
        )
        for index in range(rooms):
            await client.post(
                f"/floors/{floors.json()[0]['id']}/rooms",
                json={
                    "room_number": f"10{index + 1}",
                    "room_type": "double",
                    "total_beds": 2,
                    "monthly_rent": "8000.00",
                },
                headers=auth_headers(token),
            )

    structure = await client.get(
        f"/pgs/{pg['id']}/structure", headers=auth_headers(token)
    )
    assert structure.status_code == 200, structure.text
    by_name = {b["name"]: b for b in structure.json()}

    assert by_name["Block A"]["floor_count"] == 2
    assert by_name["Block A"]["room_count"] == 2
    assert by_name["Block A"]["bed_count"] == 4
    assert by_name["Block B"]["floor_count"] == 1
    assert by_name["Block B"]["room_count"] == 0
    assert by_name["Block B"]["bed_count"] == 0


async def test_new_setup_endpoints_are_pg_scoped_for_staff(client: AsyncClient):
    """Every new route must run the same assignment check as the old ones."""
    token = await _owner(client)
    assigned = await create_pg(client, token, "Sunrise PG", "24th Main")
    unassigned = await create_pg(client, token, "Comfort Living", "Indiranagar")

    staff = await client.post(
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
        json={"email": "ramesh@example.com", "password": staff.json()["temporary_password"]},
    )
    headers = auth_headers(login.json()["access_token"])

    for path in ("structure", "floor-overview"):
        assert (
            await client.get(f"/pgs/{assigned['id']}/{path}", headers=headers)
        ).status_code == 200, path
        assert (
            await client.get(f"/pgs/{unassigned['id']}/{path}", headers=headers)
        ).status_code == 403, path
