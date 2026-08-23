# Phase 1 — Foundation: Task Breakdown

Companion to `schema.sql` and Section 11 (Phase 1) of the plan doc. This turns Phase 1's build list into concrete, ordered tasks with real file paths, endpoint signatures, and a checklist — enough to open an editor and start.

**Estimated time:** 1.5-2 weeks (per the plan doc; adjust to your actual available hours).

Tasks are numbered in dependency order — each one assumes everything before it is done. Don't skip ahead even if a later task looks easy; several depend on the auth layer from Task 3 being correct.

---

## 1. Project setup

- [ ] Backend: `fastapi`, `sqlalchemy[asyncio]`, `alembic`, `pydantic`, `python-jose` (JWT), `passlib[bcrypt]` (password hashing), `asyncpg` (Postgres driver)
- [ ] Frontend: `create` a Vite + React + TypeScript project; install `@reduxjs/toolkit`, `react-redux`, `react-router-dom`, `tailwindcss`, `react-hook-form`, `yup`
- [ ] Postgres running locally (Docker Compose recommended — one `db` service, one volume, so `docker compose down -v` gives you a clean slate when needed)
- [ ] Run `schema.sql` against the local database directly once, to confirm it executes cleanly, **before** setting up Alembic — this separates "is my schema valid SQL" from "does my Alembic setup work," so a failure points at the right layer
- [ ] `alembic init migrations`, then generate your first migration from the SQLAlchemy models (Task 2) rather than hand-writing it — but keep `schema.sql` as the readable reference for what the migration should produce
- [ ] Frontend folder structure exactly per Section 9: `src/app`, `src/features/{auth,dashboard,properties,tenants,billing,complaints,moveouts,staff}`, `src/components/{ui,tables,forms}`, `src/services/api`, `src/hooks`, `src/types`, `src/utils`
- [ ] GitHub repo, `.env` / `.env.example` split so secrets never get committed, a root `README.md` with local setup steps (future-you will forget the Docker command)

## 2. SQLAlchemy models

Write models for the 8 Phase-1 tables only — resist the urge to model Phase 2-6 tables now, even though `schema.sql` has all 21. Adding them early means writing Alembic migrations for tables nothing uses yet, which is wasted motion until Phase 2 actually needs them.

- [ ] `users` (with `user_role` enum), `refresh_tokens`
- [ ] `pgs`, `buildings`, `floors`, `rooms`, `beds` (with `bed_status` enum)
- [ ] `staff_assignments`
- [ ] Relationships: `PG.owner`, `PG.buildings`, `Building.floors`, `Floor.rooms`, `Room.beds`, `User.staff_pgs` (via `staff_assignments`)
- [ ] Generate the Alembic migration, run it, confirm the resulting tables match `schema.sql`'s DDL for these 8 tables (column names, types, constraints)

## 3. Auth — the one piece everything else depends on

This is the highest-leverage task in Phase 1. Get this right once; every later phase's endpoints reuse it rather than reimplementing access checks.

- [ ] `POST /auth/register` — owner registration only in Phase 1 (staff/tenant accounts get created *by* an owner via Task 6, not self-registered)
- [ ] `POST /auth/login` — returns access token (short-lived, e.g. 15 min) + refresh token (long-lived, e.g. 7 days), refresh token hash stored in `refresh_tokens`
- [ ] `POST /auth/refresh` — exchanges a valid refresh token for a new access token
- [ ] `POST /auth/logout` — revokes the refresh token (sets `revoked_at`)
- [ ] Password hashing via `passlib` bcrypt — never store or log plaintext, ever, even in dev
- [ ] **One reusable dependency function** (e.g. `get_current_user`) that every protected route depends on — decodes the JWT, loads the user, checks `is_active`. This is the function every later phase's "only owner can X" or "staff must be assigned to this PG" logic builds on top of. Write it once, test it, and don't let a later phase quietly duplicate this logic in a different file.
- [ ] A second dependency, `require_role(*roles)`, built on top of the first — e.g. `require_role("owner")` for owner-only endpoints, `require_role("owner", "staff")` for shared ones
- [ ] A third dependency for PG-scoping: given a `pg_id` path/query param, confirm the current user is either the owning `owner` or a `staff` member with a row in `staff_assignments` for that PG. **This is the function that enforces the Multi-PG Access Rule from Section 2A** — every PG-scoped endpoint in every future phase calls this, so a bug here is a data-leak bug everywhere.
- [ ] Frontend: `src/features/auth` — login form, token storage (memory + refresh via httpOnly cookie or secure storage, not `localStorage` for the access token if avoidable), an axios/fetch interceptor that attaches the token and retries once on 401 via the refresh endpoint

## 4. Owner — PG, building, room, bed endpoints

All of these sit behind `require_role("owner")` plus the PG-scoping dependency from Task 3.

- [ ] `POST /pgs` — create a PG (name, address)
- [ ] `GET /pgs` — list all PGs for the current owner
- [ ] `PATCH /pgs/{pg_id}` — edit
- [ ] `POST /pgs/{pg_id}/buildings` → `POST /buildings/{id}/floors` → `POST /floors/{id}/rooms` → `POST /rooms/{id}/beds` — the nested creation chain matching the wireframe's Rooms & Beds screen
- [ ] `GET /pgs/{pg_id}/rooms` — returns rooms with nested beds and computed occupied/vacant counts (this is the query the Rooms & Beds wireframe screen calls directly)
- [ ] `PATCH /beds/{bed_id}/status` — manual override to `maintenance` (the Staff wireframe's "Rooms Needing Attention" panel needs this state to be settable, not just derived)

## 5. Owner — staff creation and PG assignment

Matches the confirmed 3-step Add Staff wireframe exactly — resist adding a 4th "permissions" step here, that's the exact thing the wireframe review corrected.

- [ ] `POST /staff` — body: `full_name`, `phone`, `email`, `staff_title` (free text), `pg_ids: [uuid]`. Creates the `users` row with `role='staff'` and one `staff_assignments` row per `pg_id`, in a single transaction
- [ ] `GET /staff` — list staff for the current owner's PGs, with assigned PG names (matches the Staff Overview table: Name, Role, Property Access, Status)
- [ ] `PATCH /staff/{id}` — edit name/title/active status
- [ ] `PATCH /staff/{id}/pgs` — add/remove PG assignments (edit access without recreating the account)
- [ ] Frontend: `src/features/staff` — the 3-step Add Staff form (Basic Info → Assign PG(s) → Review & Add) as a multi-step form with local state carried between steps, single submit on step 3

## 6. Owner UI — dashboard shell and PG switcher

- [ ] `src/features/dashboard` — All-PGs / Single-PG toggle, metric cards **hardcoded to 0 or pulled from the real bed-count query from Task 4** (real billing/complaint numbers don't exist until Phase 3-4; don't fake those specifically, just show 0 or omit the card until then — faking numbers that look real is worse than an honest placeholder)
- [ ] PG switcher dropdown in the header, wired to a small piece of global state (Redux slice, not local component state, since multiple features need to know "which PG is currently selected")
- [ ] `src/features/properties` — the Properties table screen from the wireframe (PG Name, Address, Total Beds, Occupied, Vacant, Action)

## 7. Staff-side login and scoped view

- [ ] Staff logs in via the same `/auth/login` endpoint (role comes back in the JWT claims or a `/auth/me` call)
- [ ] Frontend routing: after login, branch by role — owner goes to the owner shell, staff goes to a separate staff shell (different sidebar, per the Staff wireframe)
- [ ] `GET /staff/me/pgs` — returns only the PGs this staff member is assigned to (uses the Task 3 PG-scoping dependency internally)
- [ ] Confirm manually: log in as the staff account created in Task 5, verify the room/bed view only shows the assigned PG's data, not every PG the owner has

## Definition of Done for Phase 1 (from the plan doc, restated as a checklist)

- [ ] Owner can register and log in
- [ ] Owner can create 2+ PGs
- [ ] Owner can build out rooms and beds under each PG
- [ ] Owner can create a staff account and assign them to exactly one PG
- [ ] Staff can log in and see **only** the assigned PG — confirmed by testing with a second PG the staff member is *not* assigned to
- [ ] No tenant, billing, or complaint features exist yet — if you find yourself building any of these before this checklist is fully checked, stop and finish this list first

## Explicitly not this phase

Don't start on these even if there's spare time — the plan doc is specific that spare Phase 1 time should go to tests on the auth/permission logic instead, since every later phase depends on that being correct:

- Tenant creation or any tenant-facing screen (Phase 2)
- Any billing, invoice, or payment table or endpoint (Phase 3)
- Any complaint table or endpoint (Phase 4)
- `staff_permissions` table or any permission-picker UI (deferred to post-MVP, per Section 2A)