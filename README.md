# PG Management System

A web platform for PG (Paying Guest) owners to manage properties, beds, tenants,
rent, complaints and move-outs — and for tenants to see the same information the
owner sees.

**Current state: Phase 1 (Foundation) is complete.** Auth, the
PG → building → floor → room → bed hierarchy, and staff PG assignment all work
end to end. Tenants, billing, complaints, move-outs and dashboards arrive in
Phases 2–6 and are deliberately not built yet.

See [`Product_plan.md`](Product_plan.md) for the full plan and
[`Phase_1/`](Phase_1/) for this phase's spec, schema and task list.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 19, TypeScript, Redux Toolkit + RTK Query, React Router, Tailwind CSS v4, React Hook Form + Yup |
| Auth | JWT access token + rotating refresh token, bcrypt password hashing |
| Tests | pytest + httpx (backend), Vitest + React Testing Library (frontend) |

---

## Prerequisites

- **Python 3.12+**
- **Node.js 20.19+** — anything older trips two things: Vite 8 warns on startup,
  and `require(ESM)` failures break some test tooling. It currently builds and
  runs on 20.17, but upgrading removes both warnings.
- **PostgreSQL 16** — via Docker (preferred) or the bundled fallback below.

---

## Running it locally

### 1. Database

**With Docker** (preferred):

```bash
docker compose up -d
```

**Without Docker** — a helper script runs a real PostgreSQL from binaries
shipped by the `pgserver` package, on a fixed port, and writes the resulting
`DATABASE_URL` into `backend/.env.local`:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\devdb.py start    # initialises on first run
.\.venv\Scripts\python.exe scripts\devdb.py status
.\.venv\Scripts\python.exe scripts\devdb.py stop
.\.venv\Scripts\python.exe scripts\devdb.py reset    # destroy and rebuild
```

The database keeps running in the background between sessions — you normally
start it once and forget about it.

### 2. Backend

First time only:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env        # skip if you used devdb.py — it writes .env.local
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Every time:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Calling the venv's Python directly means you never have to activate it — which
also sidesteps PowerShell's execution-policy prompt on `Activate.ps1`.

The API is then on <http://localhost:8000>, with interactive docs at
<http://localhost:8000/docs>.

### 3. Frontend

First time only:

```powershell
cd frontend
npm install
Copy-Item .env.example .env        # VITE_API_URL, defaults to http://localhost:8000
```

Every time:

```powershell
cd frontend
npm run dev
```

The app is on <http://localhost:5173>.

> **PowerShell note:** Windows PowerShell 5.1 has no `&&` operator, so each
> `cd` goes on its own line. Use `;` if you want them on one line
> (`cd backend; npm run dev`). In Git Bash or on macOS/Linux the same commands
> work with forward slashes and `.venv/bin/` instead of `.venv\Scripts\`.

### 4. Ports

| Port | What |
|---|---|
| 5173 | frontend (Vite dev server) |
| 8000 | backend API |
| 55432 | local PostgreSQL from `devdb.py` |

If a server refuses to start because a port is taken, something is already
running on it — check with
`Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 5173,8000,55432`.

### 5. First run

1. Open <http://localhost:5173> → **Create an owner account**.
2. **Properties** → add a PG (add a second one to see PG switching).
3. **Rooms & Beds** → add a building, then a floor, then rooms, then beds.
4. **Staff** → add a staff member and assign them to one PG. Copy the temporary
   password shown — it is displayed once and never again.
5. Sign out, sign back in as that staff member, and confirm they see only the
   PG they were assigned to.

---

## Tests

```powershell
# Backend — needs the database running; creates its own `pgms_test` database.
cd backend
.\.venv\Scripts\python.exe -m pytest

# Frontend
cd frontend
npm test
```

`pytest` covers the Phase 1 Definition of Done directly: each test in
`tests/test_definition_of_done.py` maps to one numbered acceptance criterion, so
a failure names the criterion that broke.

### Verifying the schema

`sql/schema.sql` is the readable reference for the database; the Alembic
migration is what actually builds it. Those can drift silently, so:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\verify_schema.py
```

This builds a throwaway database from `schema.sql`, reads the migrated one, and
diffs columns, constraints, indexes and enum types for all 8 Phase-1 tables.
It exits non-zero on any difference.

---

## Project layout

```text
backend/
├── app/
│   ├── api/
│   │   ├── deps.py            # auth dependencies — the ONE place access is decided
│   │   └── routes/            # auth, pgs, structure (building→bed), staff
│   ├── core/                  # settings, password hashing, JWT
│   ├── db/                    # declarative base, async session
│   ├── models/                # the 8 Phase-1 tables only
│   ├── schemas/               # Pydantic request/response models
│   └── main.py
├── alembic/versions/          # migrations
├── scripts/
│   ├── devdb.py               # local Postgres without Docker
│   └── verify_schema.py       # migration vs schema.sql diff
├── sql/schema.sql             # full 21-table reference DDL (all phases)
└── tests/

frontend/src/
├── app/                       # store, router
├── features/                  # auth, dashboard, properties, staff (+ empty
│                              #   tenants/billing/complaints/moveouts for later)
├── components/{ui,tables,forms}
├── services/api/              # RTK Query base + re-auth
├── hooks/  types/  utils/
```

---

## How access control works

Three layers, each built on the one below, all in `backend/app/api/deps.py`:

1. `get_current_user` — valid token, live account.
2. `require_role(...)` — is this role allowed on this route at all.
3. `get_accessible_pg` / `ensure_pg_access` — may **this** user reach **this** PG.

Layer 3 is the Multi-PG Access Rule: an owner reaches the PGs they own, a staff
member reaches only PGs they have a `staff_assignments` row for. It refuses with
**403**, never by quietly filtering the PG out of a result — an empty list is
indistinguishable from "this PG is empty", so a silently-filtering endpoint would
hide a broken permission check instead of surfacing it.

**Staff permissions are fixed, not configurable.** Every staff member gets the
same capability set; only *which PGs* they can reach varies. There is no
`staff_permissions` table and no permission-picker UI — see `Phase_1/schema_notes.md`
for the reasoning before changing this.

---

## What Phase 1 does not include

Not oversights — these belong to later phases:

- **Phase 2** — tenants, tenant documents, bed assignment
- **Phase 3** — invoices, payments, security deposits
- **Phase 4** — complaints and their status flow
- **Phase 5** — move-out notice, inspection, settlement
- **Phase 6** — real dashboard figures, reports, in-app notifications

The dashboard deliberately shows no rent, complaint or move-out numbers rather
than showing them as zeros: a placeholder zero reads exactly like a real one.
