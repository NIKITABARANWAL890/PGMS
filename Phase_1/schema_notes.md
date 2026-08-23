# Database Schema — Design Notes

Companion to `schema.sql`. Read this first if you're about to run migrations — it explains every place the schema adds to or departs from the plan doc's Section 10 list, so nothing here is a silent surprise.

---

## Validation status

I don't have a PostgreSQL instance available in this environment to run the file directly, so this wasn't executed against a live database. What I did check by hand, statement by statement:

- **Parenthesis balance** — all 62 statements balance correctly (checked programmatically after stripping comments).
- **Foreign key ordering** — every `REFERENCES` points to a table already defined earlier in the file. PostgreSQL requires this; there's no forward-reference table in here that would fail on a straight top-to-bottom run.
- **Index targets** — every `CREATE INDEX` references a table defined before it.
- **Enum-before-use** — every custom `TYPE` is declared before the table that uses it as a column type.

What I did **not** verify: actual execution against Postgres, Alembic migration generation, or SQLAlchemy model round-tripping. **Run `psql -f schema.sql` against a real local database before trusting this in Phase 1** — hand-checking syntax catches structural errors but won't catch everything a real engine would (e.g., reserved-word collisions, a copy-paste typo, or PostgreSQL-version-specific quirks). Treat this as a strong first draft to run and fix, not a guarantee.

---

## Three additions beyond Section 10's table list

Section 10 lists 20 tables. This schema has 21, plus 16 enum types the plan doc's high-level list didn't spell out. Two tables were added, one was removed — all three are deliberate, and here's the reasoning for each:

### 1. `roles` table — removed
Section 10 lists `roles` as a separate table. The schema instead uses a `user_role` enum (`owner` / `staff` / `tenant`) directly on `users`. This isn't a downgrade — it's the correct implementation of a decision already made elsewhere in the plan: Section 2A and Phase 1 both specify a **fixed** set of roles with a **fixed** capability set per role, explicitly *not* a configurable permission system. A separate `roles` table implies rows can be added, edited, or reassigned — exactly the flexibility that was deferred to post-MVP. An enum is the more accurate model of "these three roles exist, and that's it for now."

If you do build the configurable permission matrix from Section 2A post-MVP, that's when a real `roles` table (plus the deferred `staff_permissions` table) makes sense — not before.

### 2. `refresh_tokens` table — added
Not in Section 10's list, but Phase 1 explicitly requires: *"Auth: JWT access + refresh token flow, login/logout, password hashing."* You cannot implement refresh tokens without persisting them somewhere to validate and revoke — this table was implied by Phase 1's own requirements even though the high-level table list didn't name it.

### 3. `notices` table — added
Not in Section 10's list, but both the Staff and Tenant wireframes show a live Notices panel with real content (Water Supply Maintenance, Electricity Maintenance, Rent Reminder — each with a title, body, and date). This is confirmed UI with no backing table in the original plan. Added directly, matching the wireframe's fields.

**Net effect:** nothing from Section 10 was dropped without a reason, and everything added is either a hard requirement (`refresh_tokens`) or already-confirmed UI (`notices`). If you want the plan doc to reflect this, Section 10 could get a one-line update — but functionally, the build doesn't need to wait on that.

---

## Decisions carried directly from the wireframes into columns

These are the places where a specific wireframe screen shows up as a specific schema decision — worth knowing so if the wireframe changes again, you know exactly which column to revisit.

| Wireframe element | Schema decision |
|---|---|
| Owner "Add Staff" — 3 steps, no permission picker | No `staff_permissions` table. `staff_assignments` handles PG-mapping only. `users.staff_title` is a free-text display label, not a foreign key to a permissions table. |
| Owner/Staff "Role" column showing "Manager", "Housekeeping" etc. | `staff_title VARCHAR(50)` — deliberately just a string, not an enum or FK, because it carries no functional meaning in MVP. |
| Staff "Rooms Needing Attention" — Maintenance as a distinct bed state | `bed_status` enum has three values (`occupied`, `vacant`, `maintenance`), not two. |
| Tenant "Bill Detail" — Rent / Electricity / Mess / Other Charges as separate rows | `invoice_item_type` enum matches these four labels exactly. |
| Owner "Bills & Payments" — must support partial payment, never binary paid/unpaid | `invoices.status` includes `partial` as a real state, and is described in the schema comments as **always derived** from `SUM(payments.amount)` vs `total_amount` — never set directly by the UI. |
| All 3 wireframes — locked 5-value complaint category list | `complaint_category` enum: `electrical`, `plumbing`, `internet`, `maintenance`, `other`. Exactly these five, matching what's confirmed on Owner, Staff, and Tenant screens identically. |
| Staff/Tenant complaint detail — accountability rule (staff sets status, only tenant confirms/reopens) | `complaint_status` enum includes both `resolved` and `reopened` as distinct states; the *enforcement* of who can set which is application-layer, not schema-layer — see note below. |
| Owner "Dispute Details" panel + Tenant "I Disagree with this Settlement" | `settlements` table has `disputed_at`, `disputed_by`, `dispute_reason`, `dispute_resolution_notes` as first-class columns, and `settlement_status` includes `disputed` as a real state — not bolted on as a boolean flag. |
| Owner Move-outs — full status filter tabs (Notice Given / Inspection / Settlement / Disputed / Settled) | `moveout_status` enum on `move_out_requests` covers all of these directly. |

---

## What the schema cannot enforce — read this before Phase 1

A database schema can enforce structure (this column must be a number, this row must reference a real tenant) but not business logic (only a tenant can reopen their own complaint, a bed can't be double-booked). The bottom of `schema.sql` has a full comment block on this, but the two most important ones to not lose track of:

1. **One active bed per tenant.** Nothing in the schema itself stops two tenants from being assigned the same bed at the same time — that check has to happen in the application layer, inside a transaction, when `tenants.bed_id` is set. This is exactly the check Phase 2's Definition of Done calls out: *"attempting to assign a second tenant to an already-occupied bed is rejected with a clear error rather than silently overwriting."*
2. **Complaint accountability rule.** The schema allows any user to theoretically update `complaints.status` to any value — the rule that only staff/owner can set `resolved`, and only the complaint's own tenant can `reopen` it, has to be one reusable permission check, not reimplemented per API route. This was flagged in Phase 4 of the plan doc for the same reason.

Both of these are called out again in Phase 1 tasks below, since they're foundational enough that getting them right early saves rework later.

---

## Recommended immediate next step

Before writing any endpoint code: stand up a local Postgres instance (or Docker container) and actually run `schema.sql` against it. This is a 10-minute step that will catch anything the hand-check above couldn't — and it's much cheaper to fix a syntax issue now than after SQLAlchemy models have been written against it.