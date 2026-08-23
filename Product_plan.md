# PG Management System — Product Plan

> **Update note (v3):** this pass makes the plan execution-ready. Four changes from the original: (1) Phase 0's formal owner-interview gate is dropped as impractical — validation now happens informally by using the app on a real PG and logging what still gets done manually; (2) Staff/Manager ships with a single fixed permission set in MVP, not the configurable per-flag matrix — the matrix stays in Section 2A as the post-MVP target; (3) three previously-undefined items are now concrete: default staff permissions (fixed set), settlement disputes (flaggable, resolved offline), and Reports (three named views, not an open scope); (4) Section 11 phases now each have a concrete build list, a definition of done, an explicit "not in this phase" boundary, and a rough time estimate.
>
> **Update note (v4):** Section 11 now opens with a build-flow diagram (`pg_design_assets/mvp_build_flow.svg`) showing the six phases and their sequential dependencies at a glance, before the detailed per-phase breakdown. No phase content changed — this is a visual addition only.

## 1. Project Idea

Build a web-based PG (Paying Guest) management platform that helps:

- **PG owners/managers** manage tenants, beds, rent, payments, complaints and move-outs.
- **Tenants/students** see their stay details, bills, payments and complaints in one place.

### Main goal

Reduce the need for scattered **WhatsApp messages, Excel sheets, UPI screenshots and manual records**.

### Long-term goal

Start as a strong resume project, then test it with real PGs and turn it into a SaaS product that PG owners pay for.

---

# 2. The Problem We Are Solving

## Owner/Manager problems

1. Tenant and bed information is scattered across different places.
2. Tracking rent and pending payments is often manual.
3. Security deposits and move-out settlements can cause disputes.
4. Complaints get buried in WhatsApp messages.
5. Owners do not always know which issues are pending or overdue.
6. Vacancies mean lost revenue, but owners may not have a clear view of them.
7. Managing tenant move-in/move-out is manual.
8. Communication with tenants is repetitive and fragmented.

## Tenant problems

1. They may not know exactly what they owe.
2. Payment history can be unclear.
3. Security deposit/refund calculations can cause disputes.
4. Complaints may be ignored or have no clear status.
5. Notices and updates can get lost in WhatsApp.
6. Moving out can be confusing.

## Product idea behind all of this

Create a **single source of truth** where owners and tenants can see the same important information.

---

# 2A. Role Permissions

The MVP uses **3 roles**: Owner, Staff/Manager, and Tenant.

The Owner has full control. Tenants can only access their own information.

**MVP decision on Staff/Manager:** ship with **one fixed Staff permission set**, not a configurable permission system. Every staff member the Owner adds gets the same access: manage complaints, manage move-out inspections, view tenants/rooms/beds for their assigned PG(s), and view (not create) bills. No per-staff checkbox configuration in MVP.

Reasoning: the granular permission matrix below is the *target design*, kept in this doc as the reference for V1.5+. Building it in MVP means writing and testing a permission-check on every single query before we know which of the 9 flags real staff actually need — and the validation target in Section 14 (one PG, an owner using it directly) is more likely to have zero or one staff member than a multi-person hierarchy worth configuring. Ship the fixed set, watch how the Owner actually delegates work on the real PG, then decide which flags to make configurable first. Removing a permission flag nobody used is much cheaper than adding fine-grained checks we guessed at.

The full flag list (`VIEW_PG`, `MANAGE_ROOMS_BEDS`, etc.) and the matrix below stay as documentation of where the permission model goes post-MVP — they are not something Phase 1–6 builds.

## Permission Matrix (target design — post-MVP; MVP uses the fixed Staff set above)

| Capability | Owner | Staff / Manager | Tenant |
|---|---|---|---|
| View all PGs | ✅ | ❌ | ❌ |
| Switch between PGs | ✅ | Assigned PGs only | ❌ |
| Add / remove PG | ✅ | ❌ | ❌ |
| Manage rooms & beds | ✅ | ✅ if permitted | ❌ |
| Add / remove tenants | ✅ | ✅ if permitted | ❌ |
| View tenant details | ✅ | ✅ if permitted | Own profile only |
| Upload / verify tenant documents | ✅ | ✅ if permitted | Upload own documents |
| Create bills / invoices | ✅ | ✅ if permitted | ❌ |
| Record payments | ✅ | ✅ if permitted | ❌ in MVP |
| View payment history | ✅ | ✅ if permitted | Own history |
| Manage security deposits | ✅ | ✅ if permitted | View own deposit |
| Raise complaint | ❌ | ❌ | ✅ |
| Assign complaints | ✅ | ✅ if permitted | ❌ |
| Update complaint status | ✅ | ✅ if permitted | ❌ |
| Confirm complaint resolution | ❌ | ❌ | ✅ |
| Reopen complaint | ✅ | ✅ if permitted | ✅ for own unresolved issue |
| Manage move-outs | ✅ | ✅ if permitted | Submit notice / view settlement |
| Perform move-out inspection | ✅ | ✅ if permitted | View result |
| Create final settlement | ✅ | ✅ if permitted | ❌ |
| Manage staff | ✅ | ❌ | ❌ |
| Assign staff to PGs | ✅ | ❌ | ❌ |
| Configure staff permissions | ✅ | ❌ | ❌ |
| View reports | ✅ | Limited / if permitted | ❌ |
| Manage owner/business settings | ✅ | ❌ | ❌ |
| Manage own profile | ✅ | ✅ | ✅ |

## Staff Permission Design

**Post-MVP target (not built in Phase 1-6):** the Owner can eventually grant permissions such as:

- `VIEW_PG`
- `MANAGE_ROOMS_BEDS`
- `VIEW_TENANTS`
- `MANAGE_TENANTS`
- `MANAGE_BILLS`
- `VIEW_PAYMENTS`
- `MANAGE_COMPLAINTS`
- `MANAGE_MOVE_OUTS`
- `VIEW_REPORTS`

A staff member should only see the PGs and features they are assigned to. Example of the target state:

```text
Owner
  ├── Sunrise PG
  │    ├── Manager: Ramesh
  │    └── Maintenance: Suresh
  │
  └── Green Stay
       └── Manager: Priya
```

Ramesh may eventually have `MANAGE_COMPLAINTS` and `MANAGE_MOVE_OUTS` for Sunrise PG, while Suresh may only have `MANAGE_COMPLAINTS`.

**What MVP actually builds:** every staff member gets the single fixed permission set (complaints, move-out inspections, view tenants/rooms/beds, view bills) for whichever PG(s) the Owner assigns them to. PG assignment is still per-staff (Ramesh assigned to Sunrise PG, Priya to Green Stay) — only the *within-PG* permission granularity is deferred. This keeps the multi-PG access rule below fully intact while cutting the checkbox-configuration UI and the per-flag backend checks.

## Complaint Permission Rule

The tenant **creates and tracks** a complaint. The Owner or authorized Staff/Manager **updates the operational status**. The tenant can only confirm whether the issue was actually fixed; they cannot directly mark it resolved.

```text
Tenant
  ↓
OPEN
  ↓
Owner/Staff assigns
  ↓
ASSIGNED
  ↓
Owner/Staff updates
  ↓
IN PROGRESS
  ↓
Owner/Staff marks
  ↓
RESOLVED
  ↓
Tenant confirms OR reports "Still not fixed"
  ↓
REOPENED (if necessary)
```

## Multi-PG Access Rule

One Owner can manage many PGs, but Staff must never automatically receive access to every PG. Access is based on the PG(s) assigned by the Owner.

At the backend level, every PG-specific record must be checked against the authenticated user's allowed PGs.

---

# 3. What We Learned From Competitor Research

There are already Indian PG-management products covering many basic features such as:

- Room/bed management
- Tenant records
- Rent collection
- Payment reminders
- Complaints
- Staff management
- Reports
- Mess/menu management

Examples include TrackMyPG, PG Ease, PGMASTER, PG Manager, Crib, ManagR, PGFlow and others.

## Important conclusion

Do **not** try to differentiate by simply saying:

> "We have rooms + tenants + rent + complaints."

Those are already common features.

Our potential differentiation is:

> **Make PG operations transparent and accountable.**

Later, this can become an "operations intelligence" product that tells owners what needs attention instead of only showing records.

Examples for future versions:

- Which beds are costing the owner money because they are vacant?
- Which complaints are overdue?
- Which PG has poor service quality?
- Which tenants may leave soon?
- How much food is being wasted?

These advanced features are **not part of the first MVP**.

---

# 4. Target Users / Roles

The MVP has **3 roles**. Everyone uses the same product, but each role gets a different view and different permissions.

## 1. Owner

One owner can manage **multiple PGs** from one account.

Owner can:

- Add/remove PGs
- Switch between PGs
- View all PGs together
- Manage rooms and beds
- Add/remove tenants
- Manage bills and payment records
- Add/remove staff
- Assign staff to PGs and tasks
- Manage complaints
- Manage move-outs and settlements
- View reports
- Manage owner profile and settings

## 2. Staff / Manager

Staff handles day-to-day operations for the PG(s) assigned by the Owner. Staff does **not** get full owner access.

**In MVP, every staff member gets the same fixed capability set** (no per-staff configuration — see Section 2A for the reasoning):

- View assigned PG(s), rooms, and beds
- View tenants for assigned PG(s)
- Handle complaints and maintenance: view, assign, update status
- Perform move-out inspections
- View (not create) bills for assigned PG(s)
- Manage their own profile

Post-MVP, this becomes Owner-configurable per the permission matrix in Section 2A — this list represents the target state, not what Phase 1-6 builds.

## 3. Tenant / Student

Tenant can:

- View their room/bed and PG information
- View bills and payment history
- View deposit information
- Raise complaints
- Track complaint status
- Confirm a complaint is fixed or reopen it
- View notices
- Submit move-out notice
- View final settlement
- Manage their profile and documents

# 5. MVP — What We Will Actually Build

Keep the first version small.

## Module 1 — Multi-PG & Bed Management

One Owner can create and manage **multiple PGs**.

Example:

Owner
→ Sunrise PG
→ Green Stay
→ Comfort Living

Inside every PG:

PG → Building → Floor → Room → Bed → Tenant

Owner can:

- Add/remove PG
- Switch between PGs
- View all PGs together
- Create rooms
- Create beds
- See occupied/vacant beds
- Assign tenant to a bed
- Vacate a bed

Important: **Bed is the main inventory unit**, because PGs earn money per occupied bed.

Owner dashboard should have both:

- **All PGs view** — overall occupancy, collection, vacancies, complaints
- **Single PG view** — detailed information for one selected PG

---

## Module 2 — Tenant Management

Owner can:

- Add tenant
- Store basic profile information
- Store KYC/basic documents
- Assign room/bed
- Set monthly rent
- Set security deposit
- Track tenant status

Tenant lifecycle:

Lead/Booked → Move-in → Active → Notice Given → Move-out → Settled → Exited

For the first MVP, the lead/booking part can stay very simple.

---

## Module 3 — Rent & Payments

Owner can:

- Set monthly rent
- Generate monthly invoice
- Add electricity/other charges
- Record payments
- See pending dues
- See payment history
- Track security deposit

Tenant can:

- See current bill
- See payment status
- See payment history
- See/download receipt later

Example:

August Bill
- Rent: ₹8,000
- Electricity: ₹650
- Other: ₹0
- Total: ₹8,650
- Paid: ₹8,650
- Balance: ₹0

---

## Module 4 — Complaints & Maintenance

Tenant can:

- Create complaint
- Choose category
- Describe issue
- Upload photo
- Track complaint status
- Confirm that the issue was fixed or report that it is still not fixed

Staff/Manager or Owner can:

- View complaints
- Assign complaint
- Update status
- Add internal/follow-up notes
- Mark as resolved

### Who updates the status?

**Staff/Manager or Owner updates the operational status.** The tenant does not mark their own complaint as resolved.

Basic status flow:

Open → Assigned → In Progress → Resolved

If the tenant says the problem is still not fixed:

Resolved → Reopened → In Progress

This creates accountability while allowing the tenant to confirm whether the resolution actually worked.

---

## Module 5 — Move-out & Deposit Settlement

Tenant gives notice.

Then:

1. Notice is recorded.
2. Expected move-out date is calculated.
3. Owner performs room inspection.
4. Damage/photos can be recorded.
5. Pending rent/electricity/etc. is calculated.
6. Security deposit deduction is calculated.
7. Final refund/settlement is created.
8. Bed becomes vacant.

Example:

Security deposit: ₹16,000
- Electricity: ₹650
- Damage: ₹500
- Pending rent: ₹0

Refund = ₹14,850

The important idea is that **owner and tenant see the same settlement record**.

### Disputes (MVP decision)

Section 2 names settlement disputes as one of the core tenant problems, so the settlement flow needs at least a minimal answer for disagreement — not just the happy path.

**MVP scope:** the tenant can mark a settlement as **"Disputed"** with a short text note when they view it. This changes the settlement's status and surfaces it on the Owner's dashboard under Attention Required. Resolution itself (negotiating the actual number) happens outside the app — a phone call, WhatsApp, in person — same as today. The app's job in MVP is only to make the disagreement visible and logged, not to mediate it.

**Explicitly not in MVP:** counter-offer flows, in-app negotiation/messaging on a disputed settlement, or an approval workflow for revised settlements. If a settlement is disputed and resolved offline, the Owner edits the settlement record directly and it moves back to a normal status. Building real dispute *resolution* tooling is a V1.5+ decision, made after seeing how often disputes actually happen and what they look like on the real PG.

---

## Module 6 — Dashboards

### Owner dashboard

Show the most important information immediately for either **All PGs** or one selected PG:

- Total beds
- Occupied beds
- Vacant beds
- Occupancy %
- Expected rent
- Collected rent
- Outstanding rent
- Open complaints
- Overdue complaints
- Upcoming move-outs

Also show an **Attention Required** section:

- Overdue payments
- Overdue complaints
- Upcoming move-outs
- Vacant beds

### Staff dashboard

Show the operational work that needs attention:

- Assigned PG(s)
- Open complaints
- In-progress complaints
- Overdue/priority complaints
- Assigned maintenance tasks
- Upcoming move-outs when permitted

### Tenant dashboard

Show:

- Room/bed
- Current bill
- Next due date
- Payment status
- Open complaints
- Notices

### Reports (MVP definition)

"Reports" appears throughout the plan without a definition. For MVP, **Reports is a single page, not a module** — three fixed views built directly from data already captured by Modules 1-5, no new tables and no configurability:

1. **Monthly collection summary** — expected rent vs. collected vs. outstanding, per PG, for a selected month.
2. **Occupancy over time** — occupied/vacant bed count as a simple line, last 6 months (or since launch if shorter).
3. **Complaint turnaround** — average days from Open to Resolved, per PG, last 30 days.

No filters beyond PG selection and month, no CSV export, no scheduled/emailed reports in MVP. This scope exists specifically to stop Reports from silently expanding during implementation — it was the one module in the original plan with no example anywhere, unlike every other module, which was specced down to exact rupee figures. If it needs to grow, that's a V2 decision made after the Owner has actually asked for something these three views don't cover.

### Main Owner pages in MVP

- Owner Profile
- Dashboard
- Properties
- Rooms & Beds
- Tenants
- Bills & Payments
- Complaints
- Move-outs
- Reports
- Staff
- Settings

### Main Staff pages in MVP

- Staff Profile
- Dashboard
- Assigned PG / Rooms & Beds
- Tenants (limited by permission)
- Complaints / Maintenance
- Move-outs (limited by permission)
- Notices / Tasks

### Main Tenant pages in MVP

- Tenant Profile
- Dashboard
- My Room / Stay
- Bills & Payments
- Bill Details / Receipt
- Complaints
- Raise Complaint
- Notices
- Give Notice / Move-out
- Settlement after Move-out
- Documents

---

# 6. What Is NOT in the MVP

Do not build these initially:

- Advanced mess management
- WhatsApp automation
- SMS automation
- Payment gateway
- AI chatbot
- AI calling
- Visitor management
- CCTV integration
- Parent portal
- Complex accounting
- Vendor marketplace
- Advanced predictive analytics
- Native Android/iOS app

Build a responsive web app first.

---

### Payment gateway decision for MVP

**No online payment gateway in the first MVP.**

The MVP will support:
- Creating invoices/bills
- Recording payments
- Payment history
- Outstanding dues
- Receipts

After validating the product with a real PG, we can add Razorpay/Stripe or another gateway in a later phase.

---

# 7. MVP Core Flow

The complete MVP should support this end-to-end journey:

Owner creates multiple PGs
→ creates rooms/beds inside a PG
→ adds staff and assigns permissions
→ adds tenant
→ assigns bed
→ generates rent invoice
→ records payment
→ tenant raises complaint
→ staff/manager is assigned
→ staff updates complaint status
→ tenant confirms resolution or reopens the issue
→ tenant gives move-out notice
→ owner/staff performs inspection
→ final settlement is calculated
→ deposit is settled
→ bed becomes vacant

If this complete flow works smoothly, we have a real MVP.

---

# 8. Recommended Tech Stack

The stack is chosen based on our current skills and the goal of learning full-stack development without unnecessarily adding a new backend framework.

## Frontend

- React
- TypeScript
- Redux Toolkit
- RTK Query
- React Router
- Tailwind CSS
- React Hook Form
- Yup
- Recharts

### Why

Frontend is already our strongest area, so we should make the UI polished and production-like.

RTK Query will handle server/API data, while normal Redux should be used only for genuine client/global state.

---

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy 2.0
- Alembic

### Why

We already have some FastAPI knowledge, so this is a faster path to a working backend than learning a completely new framework.

---

## Database

- PostgreSQL
- SQL

Learn properly:

- SELECT
- INSERT
- UPDATE
- DELETE
- WHERE
- ORDER BY
- GROUP BY
- HAVING
- JOIN
- Primary keys
- Foreign keys
- Constraints
- Indexes
- Transactions

Use SQLAlchemy, but do not let the ORM hide the underlying SQL concepts.

---

## Authentication & Authorization

- JWT
- Access token + refresh token
- Role-based access control

Initial roles:

- OWNER
- STAFF / MANAGER
- TENANT

Important SaaS rule:

An owner must only be able to access data belonging to their own PG/property.

---

## Testing

Frontend:

- Vitest
- React Testing Library

Backend:

- Pytest
- FastAPI TestClient

Testing can start simple and grow later.

---

## Deployment

Initial setup:

- Frontend: Vercel
- Backend: Render or Railway
- Database: Managed PostgreSQL
- Code: GitHub

Later:

- Docker
- GitHub Actions / CI/CD
- AWS if there is a real reason to move there

---

# 9. Suggested Frontend Structure

```text
src/
├── app/
│   ├── store.ts
│   └── router.tsx
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── properties/
│   ├── tenants/
│   ├── billing/
│   ├── complaints/
│   ├── moveouts/
│   └── staff/
├── components/
│   ├── ui/
│   ├── tables/
│   └── forms/
├── services/
│   └── api/
├── hooks/
├── types/
└── utils/
```

Use a **feature-based structure** rather than putting everything into one giant components folder.

---

# 10. Suggested Database Starting Point

Start with a manageable number of tables:

```text
users
roles

pgs
buildings
floors
rooms
beds

tenants
tenant_documents

invoices
invoice_items
payments
security_deposits

complaints
complaint_comments

move_out_requests
move_out_inspections
settlements

notifications
staff_assignments
```

**Deferred to post-MVP:** `staff_permissions` (needed only once the configurable permission matrix in Section 2A is built — MVP staff access is a fixed set checked in code, not a per-flag table).

Important relationships:

- One **Owner → many PGs**
- One **PG → many Staff members**
- One **PG → many Tenants**
- One **Staff member → one or more assigned PGs/tasks**
- One **Tenant → one active bed at a time**

Do not create a huge database before the workflows are clear.

---

# 11. Development Plan

**Note on Phase 0:** the original plan had a formal research phase gating Phase 1. That gate is dropped — a structured owner-interview survey isn't practical right now. Validation instead happens informally and continuously: while building and using the app on a real PG, keep a running note of "what did I still have to do manually / outside the app this week." That list feeds V1.5+ prioritization (see Section 14). This is a real substitute for external interviews, not a skipped step, but it does mean the plan is validated against one owner's experience rather than several — worth remembering if a decision here turns out not to generalize.

**Time estimates below assume solo, part-time work (evenings/weekends).** They are a planning aid, not a deadline — if a phase is running past its estimate by more than ~50%, that's a signal to stop and ask whether scope quietly grew, not a signal to work faster. Adjust the numbers to your actual available hours before treating them as real; they exist so you have *some* early warning, not because these particular numbers are load-bearing.

Each phase below has three parts: what to build, what "done" concretely means, and what NOT to build yet (so a phase doesn't quietly absorb the next one's scope).

## Build flow overview

![MVP build flow across six phases](pg_design_assets/mvp_build_flow.svg)

Each phase depends on the one directly before it — Phase 3 needs Phase 2's tenants to exist before it can bill them, Phase 5 needs both Phase 3's billing and Phase 4's complaint infrastructure, and Phase 6 doesn't add new data at all, it wires real numbers into UI shells that Phase 1 already built empty. None of the six are optional or reorderable. The detailed build list, definition of done, and explicit "not in this phase" boundary for each one follows below.

---

## Phase 1 — Foundation

**Estimated time:** 1.5-2 weeks

**Build:**

- Project setup: FastAPI backend + React/TS frontend scaffolding, PostgreSQL running locally, Alembic migrations initialized, GitHub repo with the feature-based frontend structure from Section 9
- Auth: JWT access + refresh token flow, login/logout, password hashing
- Tables: `users`, `roles`, `pgs`, `buildings`, `floors`, `rooms`, `beds`, `staff_assignments` (PG-to-staff mapping only — no `staff_permissions` table yet, since Phase 1 ships the fixed permission set from Section 2A, not a configurable one)
- Roles: Owner, Staff, Tenant as fixed enum values on `users`, checked in a single auth-dependency function reused across every endpoint (not re-implemented per route)
- Owner endpoints: create/switch/list PGs, create building → floor → room → bed hierarchy
- Owner UI: PG list/switcher, "All PGs" dashboard shell (numbers can be hardcoded to 0 for now — Phase 6 wires real data in), single-PG room/bed view showing occupied/vacant
- Staff creation: Owner can add a staff user and assign them to one or more PGs (assignment only — the fixed permission set applies automatically, no permission-picker UI)

**Definition of done:** Owner can register, log in, create 2+ PGs, build out rooms and beds under each, create a staff account, assign that staff member to one PG, log in as that staff member, and see only the assigned PG. No tenants, billing, or complaints exist yet — this phase is purely structural.

**Not in this phase:** anything tenant-, billing-, or complaint-related. Do not start Phase 2 features early even if Phase 1 finishes ahead of estimate — use spare time to add tests for the auth/permission-check logic instead, since that's the code every later phase depends on being correct.

---

## Phase 2 — Tenant Lifecycle

**Estimated time:** 1-1.5 weeks

**Build:**

- Tables: `tenants`, `tenant_documents`
- Tenant status enum: `Lead/Booked → Move-in → Active → Notice Given → Move-out → Settled → Exited` (store as a single status field on `tenants`; no separate status-history table yet — add one later only if you actually need to show a timeline)
- Owner endpoints: create tenant, assign tenant to a specific vacant bed (must fail cleanly if bed is already occupied — this is the first real business-rule check in the system), upload/store tenant documents, set tenant status
- Owner UI: tenant list, tenant detail page, "assign to bed" flow from the room/bed view built in Phase 1
- Tenant login: separate auth flow, tenant sees only their own record
- Tenant UI: minimal dashboard showing their room/bed and profile — this is intentionally thin here, Module 6's full tenant dashboard comes together in Phase 6 once bills and complaints exist to show

**Definition of done:** Owner can add a tenant, assign them to a specific bed (and the bed's occupied/vacant status updates correctly), the tenant can log in and see their own bed assignment, and attempting to assign a second tenant to an already-occupied bed is rejected with a clear error rather than silently overwriting.

**Not in this phase:** billing, complaints, or move-out. The "lead/booking" part of the lifecycle stays exactly as simple as the original plan says — a status value, not a booking pipeline with its own workflow.

---

## Phase 3 — Money

**Estimated time:** 1.5-2 weeks (the largest single-feature phase — invoice/payment logic has the most edge cases of any MVP module)

**Build:**

- Tables: `invoices`, `invoice_items`, `payments`, `security_deposits`
- Owner endpoints: set monthly rent + deposit amount on a tenant, generate monthly invoice (rent + electricity + other line items, matching the Section 5 example format), record a payment against an invoice (partial payments must be supported — "Paid: ₹5,000" against an ₹8,650 bill should correctly show ₹3,650 outstanding, not just a binary paid/unpaid flag), view outstanding dues across all tenants in a PG
- Tenant endpoints: view current bill, view payment history
- Owner UI: invoice generation form, payment recording form, per-tenant outstanding-dues view
- Tenant UI: current bill view, payment history list (matching the bill format example in Module 3)

**Definition of done:** Owner can generate an invoice for a tenant with multiple line items, record a partial payment against it, see the correct outstanding balance, and the tenant sees the identical numbers on their side — same invoice, same balance, no separate calculation logic on the two views that could drift apart.

**MVP payment decision (unchanged from original plan):** record payments manually inside the system. No Razorpay/Stripe integration. Add a payment gateway only after this workflow has been used through at least one real billing cycle.

**Not in this phase:** payment gateway, automated recurring invoice generation (generate manually each month for MVP — automating the monthly cron job is a fast V1.5 add once the manual flow is proven correct), receipts as downloadable PDFs (a receipt *view* is fine; PDF export can wait).

---

## Phase 4 — Staff & Complaints

**Estimated time:** 1-1.5 weeks (lighter than originally scoped, because Phase 1 already handles staff creation/assignment — this phase is complaints only)

**Build:**

- Tables: `complaints`, `complaint_comments`
- Complaint status enum: `Open → Assigned → In Progress → Resolved`, plus `Resolved → Reopened → In Progress` per Module 4's rule
- Tenant endpoints: create complaint (category, description, photo upload), view own complaints, confirm resolution or reopen
- Staff/Owner endpoints: view complaints for assigned PG(s), assign complaint to self or another staff member, update status, add follow-up notes
- UI: tenant complaint form + tracker, staff/owner complaint list + detail view with status controls
- Enforce the accountability rule from Module 4 directly in the API layer, not just the UI: only staff/owner roles can transition a complaint to Resolved; only the tenant who raised it can confirm or reopen it. Write this as a backend check, since a UI-only restriction is trivially bypassed by anyone calling the API directly.

**Definition of done:** a tenant can raise a complaint with a photo, a staff member (assigned via Phase 1) can see it, assign it, move it through In Progress to Resolved, and the tenant can either confirm it or reopen it — and reopening correctly puts it back to In Progress, not back to Open.

**Not in this phase:** the granular staff permission matrix (deferred per Section 2A), push/email/SMS notifications for complaint updates (in-app only, wired up in Phase 6).

---

## Phase 5 — Move-out

**Estimated time:** 1.5 weeks

**Build:**

- Tables: `move_out_requests`, `move_out_inspections`, `settlements`
- Tenant endpoint: submit move-out notice, view resulting settlement
- Owner/staff endpoints: record inspection (damage notes, photos), calculate final settlement (pending rent + electricity + damage deductions against deposit, matching the Module 5 worked example), mark settlement disputed-vs-final
- On settlement finalization: bed automatically flips to vacant in the `beds` table — this is the one place in the whole system where a Module 3/5 action needs to reach back and mutate Module 1 data, so it's worth writing a single explicit function for it (e.g. `finalize_settlement_and_vacate_bed()`) rather than letting the vacate logic live inline in the settlement endpoint, where it's easy to miss during changes later
- Dispute handling per the new MVP decision above: tenant can flag a settlement "Disputed" with a note; this surfaces on the Owner's dashboard (built in Phase 6) but has no in-app resolution flow — Owner edits the settlement record directly once resolved offline

**Definition of done:** a tenant can submit notice, the owner can record an inspection and generate a settlement matching the Module 5 example calculation, the tenant sees the identical settlement number, disputing it correctly flags the record without crashing or silently discarding the dispute note, and finalizing a non-disputed settlement correctly vacates the bed (verify this by checking the bed shows vacant in the Phase 1 room/bed view immediately after).

**Not in this phase:** in-app dispute negotiation/messaging, counter-offer flows — explicitly deferred per the Module 5 dispute decision above.

---

## Phase 6 — Dashboard & Notifications

**Estimated time:** 1-1.5 weeks

**Build:**

- Owner dashboard: wire real data into the All-PGs and Single-PG views from Phase 1 — total/occupied/vacant beds, occupancy %, expected/collected/outstanding rent (from Phase 3), open/overdue complaints (from Phase 4), upcoming move-outs (from Phase 5), and the Attention Required section combining overdue payments, overdue complaints, upcoming move-outs, and vacant beds
- Staff dashboard: assigned PG(s), open/in-progress/overdue complaints, assigned maintenance tasks
- Tenant dashboard: room/bed, current bill, next due date, payment status, open complaints, notices
- Reports page: the three fixed views defined in the new Module 6 Reports section above (monthly collection summary, occupancy over time, complaint turnaround) — no more, no less
- In-app notifications: a single `notifications` table, populated on the events that already matter most from Sections 5-6 (new complaint assigned to staff, complaint resolved for tenant, invoice generated for tenant, settlement ready for tenant) — a notification bell + list, no push/email/SMS delivery

**Definition of done:** logging in as Owner, Staff, and Tenant each shows a dashboard reflecting real current data (not zeros or placeholders), the Reports page renders the three defined views against real data from the PG in use, and performing an action that should notify someone (e.g. resolving a complaint) produces a visible in-app notification for the right user.

**At the end of Phase 6, we have the MVP** — defined concretely as: the full end-to-end flow in Section 7 runs start to finish without manual database edits, on the real PG being used for validation, for at least one full billing cycle.

---

# 12. Post-MVP Roadmap

## V1.5 — Mess

Start simple:

- Menu
- Meal attendance/opt-out
- Basic feedback

Only build advanced mess analytics after talking to real PG owners.

## V2 — Operations Intelligence

Possible features:

- Vacancy cost
- Complaint SLA/overdue analysis
- Occupancy trends
- Rent collection trends
- Tenant churn signals
- PG health score

Example:

> 12 vacant beds are estimated to cost ₹96,000/month in potential rent.

## V3 — Automation

Possible features:

- WhatsApp notifications
- Automated reminders
- Payment gateway
- Automated invoices
- Staff workflows

## V4 — SaaS

Possible features:

- Subscription billing
- Owner onboarding
- Support
- Advanced analytics
- More advanced staff roles/permissions

---

# 13. Business Model

The product is intended to become a SaaS, not just a college project.

Possible pricing directions to test later:

- Monthly subscription per PG
- Pricing by occupied bed
- Higher plans for multiple PGs/staff/analytics

Do not finalize pricing before speaking to real owners.

---

# 14. How We Validate the Business

Do not wait until the whole product is finished.

Start with one real PG.

Target:

**1 PG → 20–100 tenants → actual usage**

Ask the owner regularly:

> "What did you still have to do manually?"

That answer will tell us what to build next.

Success is not:

> "The app has 30 features."

Success is:

> "A real PG owner uses it and says it makes their work easier."

---

# 15. Resume Goal

The project should eventually be presented as a real product, not just a CRUD college project.

Possible title:

**PG Operations & Tenant Experience Platform**

Potential resume description later:

> Built a multi-tenant SaaS platform for PG owners to manage bed inventory, tenant onboarding, billing, payment records, maintenance workflows and move-out settlements through a unified dashboard.

Add real user/usage metrics only after they are actually achieved.

---

# 16. Product Positioning

Do not position it as:

> "A PG app with rooms, tenants and rent."

Better positioning:

> **A PG operations platform that helps owners manage money, occupancy and service issues in one place while giving tenants a transparent experience.**

Long-term positioning:

> **Make PG operations predictable, transparent and accountable.**

---

# 17. Final MVP Checklist

## Roles & Access

- [ ] Owner login
- [ ] Staff/Manager login
- [ ] Tenant login
- [ ] Fixed role-based access checked at the API layer (Owner / Staff / Tenant) — not the configurable per-flag matrix, see Section 2A
- [ ] Owner can assign staff to PG(s)

## Multi-PG

- [ ] One owner can create multiple PGs
- [ ] All PGs dashboard
- [ ] Single PG dashboard
- [ ] PG switching

## Owner

- [ ] Owner profile
- [ ] Properties / PG management
- [ ] Rooms & Beds
- [ ] Tenants add/remove
- [ ] Bills & Payments
- [ ] Complaints
- [ ] Move-outs & settlements
- [ ] Reports
- [ ] Staff add/remove
- [ ] Staff PG assignment (fixed permission set per Section 2A — no per-staff configuration in MVP)
- [ ] Settings

## Staff / Manager

- [ ] Staff profile
- [ ] Staff dashboard
- [ ] Assigned PG(s) visibility
- [ ] Complaints assigned to staff
- [ ] Complaint status updates
- [ ] Maintenance/task handling
- [ ] Tenant/room view access for assigned PG(s) (fixed set, not configurable)
- [ ] Move-out inspection access (included in the fixed staff set)

## Tenant

- [ ] Tenant profile
- [ ] Dashboard
- [ ] My Room / Stay
- [ ] Bills & Payments
- [ ] Payment history / receipt
- [ ] Raise complaint
- [ ] Track complaint status
- [ ] Confirm resolution / reopen complaint
- [ ] Notices
- [ ] Move-out notice
- [ ] Settlement view
- [ ] Documents

## Core Business Workflows

- [ ] Tenant onboarding and bed assignment
- [ ] Monthly invoice generation
- [ ] Payment recording
- [ ] Outstanding dues
- [ ] Security deposit tracking
- [ ] Complaint assignment and status flow
- [ ] Move-out inspection
- [ ] Deposit deduction/refund calculation
- [ ] Bed automatically becomes vacant after move-out
- [ ] In-app notifications

## Explicitly Not in MVP

- [ ] Online payment gateway
- [ ] WhatsApp automation
- [ ] SMS automation
- [ ] Advanced mess analytics
- [ ] AI features
- [ ] Visitor/CCTV modules
- [ ] Native mobile apps

# One-Line Summary

**Build a React + TypeScript + Redux + FastAPI + PostgreSQL web app where one owner can manage multiple PGs, staff can handle day-to-day operations, and tenants can manage their own stay, payments, complaints and move-out — all through role-based views.**

# 14. UI/UX Wireframes & Screen Designs

The following reference images were generated for the MVP design. They show the intended structure and user flows; they are wireframes/high-level mockups, not final production UI.

## 14.1 Owner + Tenant Wireframe Overview

![Owner and Tenant Wireframe Overview](pg_design_assets/owner_tenant_wireframe_overview.png)

## 14.2 Owner + Tenant Detailed Wireframes

![Owner and Tenant Detailed Wireframes](pg_design_assets/owner_tenant_detailed_wireframe.png)

## 14.3 Owner High-Fidelity Screens

![Owner High-Fidelity Screens](pg_design_assets/owner_high_fidelity.png)

## 14.4 Staff Detailed Screens

![Staff Detailed Screens](pg_design_assets/staff_detailed_wireframe.png)

## 14.5 Owner + Tenant End-to-End High-Level View

![Owner and Tenant End-to-End View](pg_design_assets/owner_tenant_end_to_end.png)

### Screen coverage

**Owner:** Profile, Dashboard, Properties, Rooms & Beds, Tenants, Bills & Payments, Complaints, Move-outs, Reports, Staff, Settings.

**Staff/Manager:** Dashboard, Complaints, Maintenance Tasks, Rooms & Beds, Tenants, Bills & Payments (permission-based), Notices, Move-outs, Profile, Settings.

**Tenant:** Login, Dashboard, My Room, Bills & Payments, Bill Detail, Make Payment flow, Complaints, Raise Complaint, Notices, Give Notice, Settlement, Profile, Documents.

### Important UX rules represented in the designs

- One Owner can manage multiple PGs and switch between them.
- Staff access is limited to assigned PGs and permissions.
- Staff/Manager updates complaint status; Tenant only confirms resolution or reopens an unresolved issue.
- Move-out connects notice → inspection → settlement → bed vacancy.
- Payment gateway is **not required for the MVP**; payment recording/history can be implemented first.