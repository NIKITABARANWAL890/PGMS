# Task: Implement Phase 1 (Foundation) of the PG Management System

You are implementing Phase 1 of a multi-phase MVP build for a PG (Paying Guest) management platform. Four reference documents are attached — read all four before writing any code. Do not start coding from this prompt alone; the attached files contain the actual specification, and this prompt is only the entry point and the rules for how to use them.

## Attached files — read in this order

1. **`PG_Management_System_Product_Plan_v4.md`** — the full product plan. This is the source of truth for every product decision (roles, permissions, what's in/out of MVP, the six-phase build sequence). Read Section 2A (Role Permissions), Section 9 (Frontend Structure), Section 10 (Database Starting Point), and Section 11 → Phase 1 in full. You do not need to deeply read Modules 2-6 of Section 5 or Phases 2-6 of Section 11 — those are future phases, out of scope for this task — but skim them enough to understand *why* Phase 1 is scoped the way it is (e.g. why `staff_permissions` doesn't exist yet).
2. **`schema.sql`** — the full PostgreSQL DDL for all 21 MVP tables across all 6 phases. **You will only implement 8 of these 21 tables in this task** — see "Scope" below. The other 13 tables exist in this file for future phases; do not create migrations for them yet.
3. **`schema_notes.md`** — explains every non-obvious schema decision, including three places where the schema deliberately deviates from the plan doc's own high-level table list. Read this fully; it will stop you from "fixing" something that was a deliberate call, not an oversight.
4. **`phase1_tasks.md`** — the ordered task breakdown for exactly this phase. This is your primary task list. Follow its task order — task 3 (auth) must be correct before tasks 4-7 build on it.

If any instruction in this prompt appears to conflict with the attached files, **the attached files win** — this prompt is a wrapper, not an override.

## Scope — implement exactly these 8 tables, nothing else

From `schema.sql`, implement only: `users`, `refresh_tokens`, `pgs`, `buildings`, `floors`, `rooms`, `beds`, `staff_assignments`.

Do **not** create tables, models, or migrations for: `tenants`, `tenant_documents`, `invoices`, `invoice_items`, `payments`, `security_deposits`, `complaints`, `complaint_comments`, `move_out_requests`, `move_out_inspections`, `settlements`, `notices`, `notifications`, or `staff_permissions`. These belong to Phases 2 through 6 or to a post-MVP roadmap item, and `phase1_tasks.md` §2 explicitly says not to build them early — modeling them now creates migrations for tables nothing uses yet, which is wasted motion and makes the Phase 1 diff harder to review.

If you find yourself wanting to reference one of these tables (e.g. a foreign key from `beds` to a future `tenants` table) — don't. Phase 1 has no tenants yet. Leave that relationship for Phase 2 to add.

## What "done" means — self-check before finishing

Do not report this task complete until every item below is independently true. These are restated from `phase1_tasks.md`'s Definition of Done section, phrased so you can verify each one yourself rather than taking your own prior step's success on faith:

1. A fresh `owner`-role user can register via `POST /auth/register` and log in via `POST /auth/login`, receiving both an access token and a refresh token.
2. That owner can create at least 2 PGs, and `GET /pgs` returns both, scoped only to that owner (create a second owner and confirm they see zero PGs, not the first owner's).
3. The owner can build out the full `PG → building → floor → room → bed` hierarchy under at least one PG, and `GET /pgs/{pg_id}/rooms` returns the correct nested structure with accurate occupied/vacant bed counts.
4. The owner can create a staff account via `POST /staff`, assigning them to exactly one of the two PGs, in a single transaction (confirm no orphaned `users` row exists if the `staff_assignments` insert fails).
5. That staff account can log in via the same `/auth/login` endpoint, and `GET /staff/me/pgs` returns only the one assigned PG.
6. **Negative test, not optional**: create a third PG under the owner that the staff member is *not* assigned to, and confirm the staff account gets a 403 (or equivalent) when trying to access that PG's rooms/beds — not an empty list, an explicit denial. An empty list would mean the endpoint is silently filtering; a 403 means the permission check actually ran. This distinction matters — verify it explicitly.
7. No tenant, billing, or complaint endpoint exists anywhere in the codebase (grep for it if unsure).

If any of these 7 don't hold, the task isn't done — fix it before reporting completion, don't report partial completion as done.

## Rules for ambiguity

You are working autonomously without a human to ask mid-task. Where the attached files are genuinely silent on an implementation detail (e.g. exact JWT expiry duration, exact password complexity rules), make a reasonable, secure default choice, and **log it clearly** in your final summary under a "Decisions made without explicit spec" heading — don't bury it in a code comment where it'll be missed. Do not guess on anything that affects the product's behavior as described in the plan doc (roles, permission scoping, which endpoints exist) — those are specified, not ambiguous, and should be implemented exactly as written, not reinterpreted.

Two decisions are pre-made and **not yours to reopen**, because they were arrived at after several rounds of review and correction:
- **No staff permission picker.** Staff get one fixed capability set via `staff_assignments` (PG mapping only). Do not add a `staff_permissions` table, a permissions field, or a role-picker UI beyond the single free-text `staff_title` label. `schema_notes.md` explains why at length — read it before you consider "improving" this.
- **No `roles` table.** Roles are the fixed enum `user_role` (`owner`/`staff`/`tenant`) directly on `users`. This is deliberate, not an oversight — see `schema_notes.md` §1.

## Stack (from the plan doc, Section 8 — do not substitute)

- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy 2.0 (async), Alembic, PostgreSQL
- **Frontend:** React, TypeScript, Redux Toolkit + RTK Query, React Router, Tailwind CSS, React Hook Form, Yup
- **Auth:** JWT access + refresh token pair, `passlib` bcrypt for password hashing
- **Folder structure:** exactly the layout in the plan doc's Section 9 — `src/app`, `src/features/{auth,dashboard,properties,tenants,billing,complaints,moveouts,staff}`, `src/components/{ui,tables,forms}`, `src/services/api`, `src/hooks`, `src/types`, `src/utils`. Create the full `features/` folder set now even though only `auth`, `dashboard`, `properties`, and `staff` get real content in Phase 1 — the empty folders are a deliberate placeholder for phases 2-6, not clutter to remove.

## Before you write code

1. Run `schema.sql` against a local Postgres instance directly once, to confirm the 8 in-scope tables' DDL executes cleanly — this file has not been executed against a live database before, only checked by hand for syntax (see `schema_notes.md`'s "Validation status" section). If it fails, fix the DDL for the affected table(s) and report what you changed and why — don't silently patch around a schema bug.
2. Set up Alembic and generate your first migration from SQLAlchemy models, rather than hand-writing the migration — but the running `schema.sql` output is your ground truth for what that migration should produce.

## Final deliverable

At the end of this task, provide:
1. A summary of what was built, mapped against the 7-point "done" checklist above — confirm each one explicitly, don't just say "Phase 1 complete."
2. The "Decisions made without explicit spec" list, if any.
3. Any place you found `schema.sql` didn't execute cleanly, and what you changed.
4. Instructions for a human to run the project locally (this should also live in the repo's `README.md`, per `phase1_tasks.md` §1).

Do not proceed to any Phase 2 task (tenant creation, tenant-facing screens, or anything referencing a `tenants` table) even if Phase 1 finishes with time or budget to spare. Stop, report completion, and wait for the next instruction.