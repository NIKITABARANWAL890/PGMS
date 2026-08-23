"""The Phase 1 Definition of Done, as executable checks.

Each test maps to one numbered item in the phase's done-checklist, so a failure
here says exactly which acceptance criterion stopped holding.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from tests.conftest import (
    auth_headers,
    build_room_with_beds,
    create_pg,
    register_owner,
)

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------- criterion 1
async def test_owner_can_register_and_login_receiving_both_tokens(client: AsyncClient):
    registration = await register_owner(client)
    assert registration["access_token"]
    assert registration["refresh_token"]
    assert registration["token_type"] == "bearer"

    login = await client.post(
        "/auth/login", json={"email": "owner@example.com", "password": "OwnerPass123"}
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["access_token"] and body["refresh_token"]

    me = await client.get("/auth/me", headers=auth_headers(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["role"] == "owner"


async def test_refresh_rotates_and_logout_revokes(client: AsyncClient):
    tokens = await register_owner(client)

    refreshed = await client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200, refreshed.text
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # The old refresh token was rotated out, so replaying it must fail.
    replay = await client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401

    logout = await client.post(
        "/auth/logout", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert logout.status_code == 204

    after_logout = await client.post(
        "/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert after_logout.status_code == 401


async def test_protected_route_rejects_missing_and_garbage_tokens(client: AsyncClient):
    assert (await client.get("/pgs")).status_code == 401
    assert (
        await client.get("/pgs", headers=auth_headers("not-a-real-token"))
    ).status_code == 401


# --------------------------------------------------------------- criterion 2
async def test_owner_sees_own_pgs_and_never_another_owners(client: AsyncClient):
    first = await register_owner(client)
    await create_pg(client, first["access_token"], "Sunrise PG", "Koramangala, Bangalore")
    await create_pg(client, first["access_token"], "Green Stay", "HSR Layout, Bangalore")

    listed = await client.get("/pgs", headers=auth_headers(first["access_token"]))
    assert listed.status_code == 200
    names = sorted(pg["name"] for pg in listed.json())
    assert names == ["Green Stay", "Sunrise PG"]

    second = await register_owner(
        client, email="other@example.com", phone="9000000001", full_name="Other Owner"
    )
    other_list = await client.get("/pgs", headers=auth_headers(second["access_token"]))
    assert other_list.status_code == 200
    assert other_list.json() == [], "a second owner must not see the first owner's PGs"


async def test_owner_cannot_reach_another_owners_pg_directly(client: AsyncClient):
    first = await register_owner(client)
    pg = await create_pg(client, first["access_token"], "Sunrise PG", "Koramangala")

    second = await register_owner(
        client, email="other@example.com", phone="9000000001", full_name="Other Owner"
    )
    response = await client.get(
        f"/pgs/{pg['id']}/rooms", headers=auth_headers(second["access_token"])
    )
    assert response.status_code == 403


# --------------------------------------------------------------- criterion 3
async def test_full_hierarchy_and_accurate_bed_counts(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")

    built = await build_room_with_beds(
        client, token, pg["id"], room_number="101", bed_labels=("Bed A", "Bed B")
    )

    rooms = await client.get(f"/pgs/{pg['id']}/rooms", headers=auth_headers(token))
    assert rooms.status_code == 200, rooms.text
    body = rooms.json()

    assert body["pg_name"] == "Sunrise PG"
    assert body["total_beds"] == 2
    assert body["vacant_beds"] == 2
    assert body["occupied_beds"] == 0

    assert len(body["rooms"]) == 1
    room = body["rooms"][0]
    assert room["room_number"] == "101"
    assert room["floor_label"] == "1st Floor"
    assert room["building_name"] == "Main Building"
    assert len(room["beds"]) == 2
    assert room["vacant_beds"] == 2

    # Flipping one bed to maintenance must move the counts, since occupancy is
    # derived from bed status rather than stored alongside it.
    bed_id = built["beds"][0]["id"]
    patched = await client.patch(
        f"/beds/{bed_id}/status", json={"status": "maintenance"}, headers=auth_headers(token)
    )
    assert patched.status_code == 200, patched.text

    rooms_after = await client.get(f"/pgs/{pg['id']}/rooms", headers=auth_headers(token))
    body_after = rooms_after.json()
    assert body_after["total_beds"] == 2
    assert body_after["vacant_beds"] == 1
    assert body_after["maintenance_beds"] == 1

    # The Properties table reads the same numbers from a different query; if
    # those two ever disagree the UI shows two different truths.
    pg_list = await client.get("/pgs", headers=auth_headers(token))
    summary = pg_list.json()[0]
    assert summary["total_beds"] == 2
    assert summary["vacant_beds"] == 1
    assert summary["maintenance_beds"] == 1


async def test_bed_cannot_be_marked_occupied_directly(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    built = await build_room_with_beds(client, token, pg["id"])

    response = await client.patch(
        f"/beds/{built['beds'][0]['id']}/status",
        json={"status": "occupied"},
        headers=auth_headers(token),
    )
    assert response.status_code == 400, "occupancy comes from tenant assignment (Phase 2)"


async def test_room_capacity_is_respected(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    built = await build_room_with_beds(
        client, token, pg["id"], bed_labels=("Bed A", "Bed B")
    )

    overflow = await client.post(
        f"/rooms/{built['room_id']}/beds",
        json={"bed_label": "Bed C"},
        headers=auth_headers(token),
    )
    assert overflow.status_code == 409

    duplicate = await client.post(
        f"/rooms/{built['room_id']}/beds",
        json={"bed_label": "Bed A"},
        headers=auth_headers(token),
    )
    assert duplicate.status_code == 409


# --------------------------------------------------------------- criterion 4
async def test_staff_creation_assigns_pg_in_one_transaction(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    sunrise = await create_pg(client, token, "Sunrise PG", "Koramangala")
    await create_pg(client, token, "Green Stay", "HSR Layout")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "staff_title": "Manager",
            "pg_ids": [sunrise["id"]],
        },
        headers=auth_headers(token),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["staff_title"] == "Manager"
    assert [pg["id"] for pg in body["assigned_pgs"]] == [sunrise["id"]]
    assert body["temporary_password"], "owner needs a credential to hand over"

    # No permission fields anywhere in the payload -- staff capability is fixed.
    assert "permissions" not in body


async def test_failed_staff_create_leaves_no_orphan_user(
    client: AsyncClient, db_session
):
    """A rejected assignment must not leave behind a usable account.

    The users insert and the staff_assignments inserts share one transaction, so
    a PG the owner does not own has to roll the whole thing back -- otherwise an
    account would exist that can log in but reach nothing.
    """
    from app.models import User

    owner = await register_owner(client)
    token = owner["access_token"]
    await create_pg(client, token, "Sunrise PG", "Koramangala")

    other_owner = await register_owner(
        client, email="other@example.com", phone="9000000001", full_name="Other Owner"
    )
    foreign_pg = await create_pg(
        client, other_owner["access_token"], "Not Yours PG", "Elsewhere"
    )

    before = await db_session.scalar(
        select(func.count(User.id)).where(User.email == "ramesh@example.com")
    )
    assert before == 0

    rejected = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "staff_title": "Manager",
            "pg_ids": [foreign_pg["id"]],
        },
        headers=auth_headers(token),
    )
    assert rejected.status_code == 403

    after = await db_session.scalar(
        select(func.count(User.id)).where(User.email == "ramesh@example.com")
    )
    assert after == 0, "a rejected staff create must not leave an orphaned users row"

    # And the account really cannot be used.
    login = await client.post(
        "/auth/login", json={"email": "ramesh@example.com", "password": "anything"}
    )
    assert login.status_code == 401


# --------------------------------------------------------------- criterion 5
async def test_staff_logs_in_and_sees_only_the_assigned_pg(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    sunrise = await create_pg(client, token, "Sunrise PG", "Koramangala")
    green = await create_pg(client, token, "Green Stay", "HSR Layout")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "staff_title": "Manager",
            "pg_ids": [sunrise["id"]],
        },
        headers=auth_headers(token),
    )
    temp_password = created.json()["temporary_password"]

    login = await client.post(
        "/auth/login", json={"email": "ramesh@example.com", "password": temp_password}
    )
    assert login.status_code == 200, login.text
    staff_token = login.json()["access_token"]

    me = await client.get("/auth/me", headers=auth_headers(staff_token))
    assert me.json()["role"] == "staff"

    assigned = await client.get(
        "/staff/me/pgs", headers=auth_headers(staff_token)
    )
    assert assigned.status_code == 200
    assert [pg["id"] for pg in assigned.json()] == [sunrise["id"]]
    assert green["id"] not in [pg["id"] for pg in assigned.json()]


async def test_staff_cannot_use_owner_only_endpoints(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    sunrise = await create_pg(client, token, "Sunrise PG", "Koramangala")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [sunrise["id"]],
        },
        headers=auth_headers(token),
    )
    staff_login = await client.post(
        "/auth/login",
        json={
            "email": "ramesh@example.com",
            "password": created.json()["temporary_password"],
        },
    )
    staff_token = staff_login.json()["access_token"]

    # Creating PGs, listing all PGs, and creating staff are owner-only.
    assert (
        await client.post(
            "/pgs",
            json={"name": "Sneaky PG", "address": "Nowhere"},
            headers=auth_headers(staff_token),
        )
    ).status_code == 403
    assert (await client.get("/pgs", headers=auth_headers(staff_token))).status_code == 403
    assert (
        await client.post(
            "/staff",
            json={
                "full_name": "X",
                "phone": "9000000009",
                "email": "x@example.com",
                "pg_ids": [sunrise["id"]],
            },
            headers=auth_headers(staff_token),
        )
    ).status_code == 403


# --------------------------------------------------------------- criterion 6
async def test_unassigned_pg_returns_403_not_an_empty_list(client: AsyncClient):
    """The negative test the phase spec calls out explicitly.

    An empty list would mean the endpoint quietly filtered the PG out, which is
    indistinguishable from "this PG has no rooms" and would hide a broken
    permission check. A 403 proves the check actually ran and refused.
    """
    owner = await register_owner(client)
    token = owner["access_token"]

    assigned_pg = await create_pg(client, token, "Sunrise PG", "Koramangala")
    unassigned_pg = await create_pg(client, token, "Comfort Living", "Indiranagar")

    # Both PGs have real rooms and beds, so an empty response could not be
    # explained away as "there was nothing there".
    await build_room_with_beds(client, token, assigned_pg["id"], room_number="101")
    await build_room_with_beds(client, token, unassigned_pg["id"], room_number="201")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [assigned_pg["id"]],
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

    allowed = await client.get(f"/pgs/{assigned_pg['id']}/rooms", headers=staff_headers)
    assert allowed.status_code == 200
    assert allowed.json()["total_beds"] == 2

    denied = await client.get(f"/pgs/{unassigned_pg['id']}/rooms", headers=staff_headers)
    assert denied.status_code == 403, (
        f"expected an explicit denial, got {denied.status_code}: {denied.text}"
    )

    denied_buildings = await client.get(
        f"/pgs/{unassigned_pg['id']}/buildings", headers=staff_headers
    )
    assert denied_buildings.status_code == 403


async def test_staff_pg_assignment_can_be_edited_without_recreating_account(
    client: AsyncClient,
):
    owner = await register_owner(client)
    token = owner["access_token"]
    sunrise = await create_pg(client, token, "Sunrise PG", "Koramangala")
    green = await create_pg(client, token, "Green Stay", "HSR Layout")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [sunrise["id"]],
        },
        headers=auth_headers(token),
    )
    staff_id = created.json()["id"]
    staff_login = await client.post(
        "/auth/login",
        json={
            "email": "ramesh@example.com",
            "password": created.json()["temporary_password"],
        },
    )
    staff_headers = auth_headers(staff_login.json()["access_token"])

    assert (
        await client.get(f"/pgs/{green['id']}/rooms", headers=staff_headers)
    ).status_code == 403

    updated = await client.patch(
        f"/staff/{staff_id}/pgs",
        json={"pg_ids": [sunrise["id"], green["id"]]},
        headers=auth_headers(token),
    )
    assert updated.status_code == 200, updated.text
    assert len(updated.json()["assigned_pgs"]) == 2

    # Access follows the assignment immediately -- no re-login required.
    assert (
        await client.get(f"/pgs/{green['id']}/rooms", headers=staff_headers)
    ).status_code == 200


async def test_deactivated_staff_loses_access(client: AsyncClient):
    owner = await register_owner(client)
    token = owner["access_token"]
    sunrise = await create_pg(client, token, "Sunrise PG", "Koramangala")

    created = await client.post(
        "/staff",
        json={
            "full_name": "Ramesh Kumar",
            "phone": "9876543211",
            "email": "ramesh@example.com",
            "pg_ids": [sunrise["id"]],
        },
        headers=auth_headers(token),
    )
    staff_id = created.json()["id"]
    login = await client.post(
        "/auth/login",
        json={
            "email": "ramesh@example.com",
            "password": created.json()["temporary_password"],
        },
    )
    staff_headers = auth_headers(login.json()["access_token"])
    assert (await client.get("/staff/me/pgs", headers=staff_headers)).status_code == 200

    deactivated = await client.patch(
        f"/staff/{staff_id}", json={"is_active": False}, headers=auth_headers(token)
    )
    assert deactivated.status_code == 200

    # Existing access token stops working straight away, rather than lingering
    # until it expires.
    assert (await client.get("/staff/me/pgs", headers=staff_headers)).status_code == 403
    relogin = await client.post(
        "/auth/login",
        json={
            "email": "ramesh@example.com",
            "password": created.json()["temporary_password"],
        },
    )
    assert relogin.status_code == 403
