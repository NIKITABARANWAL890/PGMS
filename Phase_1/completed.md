# Phase 1 — What We Actually Built

A plain-language summary of what exists today, feature by feature. Written for
a quick read, not a spec — see `tasks.md` for the original task list and
`schema.md` for the database.

**Status: done.** Every original Definition-of-Done item passes, plus a good
amount of real UI work that went beyond the original minimum scope because it
made the product genuinely usable instead of just technically complete.

---

## 1. Logging in

- An owner can create an account and log in.
- Staff accounts don't self-register — an owner creates them (see Staff,
  below) and hands over a one-time password.
- Sessions stay signed in across a page reload, and log out actually ends the
  session rather than just forgetting it in the browser.
- Everyone gets their own profile page: edit your name/email/phone, change
  your password, upload a profile photo. Staff especially need this, since
  their first password is one someone else typed for them.

## 2. Properties (PGs)

- An owner can add as many PGs as they run, each with real details — name,
  type (Girls/Boys/Co-living), full address, contact info, an internal code.
- The Properties page lists them all as cards (occupancy bar, bed counts at a
  glance), with a filter dropdown to narrow down to one when you have several.
- A PG can be deleted — but only if every bed in it is empty. You can't
  accidentally delete a property with tenants still living in it (well,
  "empty" as far as Phase 1 can tell — tenants themselves arrive in Phase 2).

## 3. Setting up a property: buildings → floors → rooms → beds

This is the core of Phase 1 — turning an empty PG into a real, bookable
property.

- **Guided setup**: after adding a PG, a step-by-step wizard walks you through
  the rest — building, then floor count, then a hub screen showing every floor
  and whether it's configured yet.
- **Floors are generated, not typed one by one.** Say "4 floors" and you get
  Floor 1 through Floor 4 immediately.
- **Rooms are numbered for you.** Configuring Floor 2 offers "201, 202, 203…"
  automatically — you can rename any of them, but you never have to invent the
  numbering scheme yourself.
- **Beds inherit the room's rent** unless you give one a different number, and
  a whole room's worth of beds ("Bed A, Bed B, Bed C…") can be created in one
  click instead of one at a time.
- Every one of these — building, floor, room, bed — can also be **deleted**,
  again blocked only if a bed involved is occupied.
- A dedicated page for each floor shows every room on it with its beds inline,
  so "what's actually on Floor 3" is one click away, not a hunt.

## 4. The property workspace

Once a PG has some structure, opening it gives it its own dedicated space:

- A **banner** at the top always shows which property you're in — name,
  status, address — so that's never in doubt.
- A **side menu specific to that PG** — Dashboard, Details, Buildings &
  Floors, Rooms, Beds, Staff — each showing only that property's data.
- Tabs for Tenants, Documents, and Activity are visible but intentionally
  disabled with a "soon" label — they need database tables that don't exist
  until later phases, so they're honestly marked rather than hidden or faked.

## 5. Staff

- An owner can add staff and assign each one to one or more of their
  properties — a 3-step form (basic info → pick properties → review).
- Every staff member gets the exact same set of abilities (handle complaints,
  do move-out inspections, view — not create — bills) for whichever
  properties they're assigned to. There's no per-person permission picker in
  this phase — that's intentionally deferred (see `schema_notes.md` for why).
- **This is the one rule tested hardest**: a staff member can only ever see
  the properties they're assigned to. Trying to reach any other property
  returns an explicit "not allowed," never a blank screen that quietly hides
  the data — the difference matters, because a blank screen could just as
  easily mean "this property has nothing in it," which would hide a real bug.

## 6. Dashboards

- **Owner dashboard**: total properties, beds, occupied/vacant, combined
  across everything the owner has. It does not fake numbers — occupancy is
  real; rent, complaints, and move-out figures are visibly absent rather than
  shown as misleading zeros, because those need Phases 3–5.
- **Staff dashboard**: which properties they're assigned to, with the same
  "not yet" honesty for numbers that don't exist yet.

## 7. Getting around

- A logo and account menu sit in a bar across the top of every page; the
  account menu opens straight to Profile or Logout.
- Every page more than one click deep shows a breadcrumb trail, so getting
  back from "Floor 2 → Room 201" is one click, not the browser's back button.
- Opening a property collapses the main menu down to icons only (so it isn't
  competing for space with that property's own menu) — hover it to see the
  full labels again, or just click an icon straight away.

---

## What's deliberately not here yet

Nothing below is missing by accident — each needs a later phase's tables or
rules to exist first:

| Not yet built | Arrives in |
|---|---|
| Tenants, tenant documents, assigning someone to a bed | Phase 2 |
| Invoices, rent payments, security deposits | Phase 3 |
| Complaints and their status flow | Phase 4 |
| Move-out notices, inspections, settlements | Phase 5 |
| Real rent/complaint numbers on dashboards, notifications, reports | Phase 6 |

A bed can be `vacant` or `maintenance` today, but nothing can mark it
`occupied` — that only makes sense once a tenant exists to occupy it, so the
API actively refuses to set it early rather than letting the number lie.

---

## The numbers, if you want proof rather than a summary

- **49** backend tests passing, **40** frontend tests passing.
- **28** API endpoints, checked to contain zero tenant/billing/complaint code —
  confirming Phase 1 hasn't quietly absorbed later phases' work.
- The database migration matches the reference schema exactly, column for
  column, across all 8 Phase 1 tables.
