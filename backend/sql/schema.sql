-- =====================================================================
-- PG Management System — MVP Database Schema
-- =====================================================================
-- Source of truth: PG_Management_System_Product_Plan_v3.md (Section 10)
-- Cross-checked against confirmed wireframes:
--   - Owner:  ChatGPT_Image_Aug_23_2026_05_33_50_PM.png
--   - Staff:  staff_mvp_wireframe_v2.png
--   - Tenant: tenant_mvp_wireframe_v2.png
--
-- Every table below maps to a specific wireframe screen or plan section.
-- Comments call out where a wireframe decision became a column, so this
-- file can be checked against the UI directly, not just against prose.
--
-- Target: PostgreSQL 15+, managed via SQLAlchemy 2.0 + Alembic (Section 8)
-- =====================================================================


-- =====================================================================
-- 1. AUTH & ROLES
-- =====================================================================
-- Phase 1. Roles are a fixed enum, not a separate configurable table —
-- Section 2A explicitly defers configurable permissions to post-MVP.

CREATE TYPE user_role AS ENUM ('owner', 'staff', 'tenant');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role            user_role NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(15) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    -- Staff job-title label only — Owner/Staff wireframes show "Role" as
    -- display text (e.g. "Manager", "Housekeeping"), NOT a functional
    -- permission tier. Every staff user gets the identical fixed
    -- capability set from Section 2A regardless of this value.
    staff_title     VARCHAR(50),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);


-- =====================================================================
-- 2. PGs, BUILDINGS, ROOMS, BEDS
-- =====================================================================
-- Phase 1. Owner wireframe: Properties table (PG Name, Address, Beds,
-- Occupied, Vacant, Tenants). Rooms & Beds screen: Room No, Floor, Type,
-- Total Beds, Occupied, Vacant.

-- Owner UI guide 3.1: the PG Details step collects identity only. Every
-- column below is one row of that table.
-- Named pg_gender_type, not pg_type: PostgreSQL already has a system
-- catalog type called pg_type, and shadowing it in `public` breaks tools
-- that look enums up by bare name.
CREATE TYPE pg_gender_type AS ENUM ('girls', 'boys', 'co_living');

CREATE TABLE pgs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id),
    name            VARCHAR(150) NOT NULL,           -- "Sunrise PG"
    address         VARCHAR(255) NOT NULL,           -- "24th Main, Koramangala"
    -- Nullable for a reason: PGs created before these fields existed have no
    -- honest value to backfill, and inventing one ("co_living" for every old
    -- row) would look like data the owner entered. The API requires them on
    -- create; the Details tab shows a blank and prompts to fill it in.
    pg_type         pg_gender_type,                  -- Girls / Boys / Co-living
    city            VARCHAR(100),                    -- "Bengaluru"
    state           VARCHAR(100),                    -- "Karnataka"
    pincode         VARCHAR(10),                     -- "560034"
    contact_phone   VARCHAR(15),
    contact_email   VARCHAR(255),
    pg_code         VARCHAR(20),                     -- "SPG001", owner-facing identifier
    description     TEXT,                            -- "Near metro, fully furnished"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pgs_owner ON pgs(owner_id);

-- Guide 3.2: a Single-Building PG gets an automatic "Main Building"; a
-- Multiple-Building PG has each one named by the owner. No description or
-- status at building level -- the guide is explicit about that.
CREATE TABLE buildings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_id           UUID NOT NULL REFERENCES pgs(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL DEFAULT 'Main Building',
    building_code   VARCHAR(20),                     -- optional, e.g. "MB-01"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE floors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_label     VARCHAR(50) NOT NULL,            -- "1st Floor", "2nd Floor"
    floor_order     INT NOT NULL DEFAULT 0,          -- for sort order in UI
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE room_type AS ENUM ('single', 'double', 'triple', 'sharing');

CREATE TABLE rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_number     VARCHAR(20) NOT NULL,            -- "101", "102"
    room_type       room_type NOT NULL,
    total_beds      INT NOT NULL CHECK (total_beds > 0),
    -- Guide 3.5 makes room rent required, and 3.6 has beds inherit it unless
    -- a bed overrides. Nullable here only so rooms created before this column
    -- existed remain valid; the API requires it on create.
    monthly_rent    NUMERIC(10,2),
    description     TEXT,                            -- "AC, attached bathroom"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (floor_id, room_number)
);

CREATE TYPE bed_status AS ENUM ('occupied', 'vacant', 'maintenance');

CREATE TABLE beds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_label       VARCHAR(20) NOT NULL,            -- "Bed A", "Bed B"
    -- Staff wireframe "Rooms Needing Attention" panel shows a distinct
    -- Maintenance state (separate from occupied/vacant) — captured here.
    status          bed_status NOT NULL DEFAULT 'vacant',
    monthly_rent    NUMERIC(10,2),                   -- can be overridden per-tenant on tenants.monthly_rent
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, bed_label)
);

CREATE INDEX idx_beds_room ON beds(room_id);
CREATE INDEX idx_beds_status ON beds(status);


-- =====================================================================
-- 3. STAFF ASSIGNMENT (fixed permission set — no staff_permissions table)
-- =====================================================================
-- Phase 1. Owner "Add Staff" wireframe: 3 steps (Basic Info → Assign
-- PG(s) → Review & Add), NO permission-picker step. Every staff user
-- gets the identical capability set from Section 2A, enforced in the
-- auth-dependency function (see application-layer note at bottom of file),
-- not via a database permission table.
--
-- staff_permissions is intentionally NOT created here — Section 10
-- explicitly defers it to post-MVP.

CREATE TABLE staff_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pg_id           UUID NOT NULL REFERENCES pgs(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (staff_id, pg_id)
);

CREATE INDEX idx_staff_assignments_staff ON staff_assignments(staff_id);
CREATE INDEX idx_staff_assignments_pg ON staff_assignments(pg_id);


-- =====================================================================
-- 4. TENANTS
-- =====================================================================
-- Phase 2. Tenant lifecycle status matches Module 2's exact enum values.

CREATE TYPE tenant_status AS ENUM (
    'lead_booked', 'move_in', 'active', 'notice_given',
    'move_out', 'settled', 'exited'
);

CREATE TABLE tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE REFERENCES users(id),  -- nullable: a "lead" may not have login access yet
    pg_id               UUID NOT NULL REFERENCES pgs(id),
    bed_id              UUID REFERENCES beds(id),           -- null until assigned; one active bed at a time (enforced at app layer)
    full_name           VARCHAR(150) NOT NULL,
    phone               VARCHAR(15) NOT NULL,
    email               VARCHAR(255),
    date_of_birth       DATE,
    emergency_contact_name  VARCHAR(150),
    emergency_contact_phone VARCHAR(15),
    monthly_rent        NUMERIC(10,2) NOT NULL,
    security_deposit    NUMERIC(10,2) NOT NULL,
    status              tenant_status NOT NULL DEFAULT 'lead_booked',
    move_in_date        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_pg ON tenants(pg_id);
CREATE INDEX idx_tenants_bed ON tenants(bed_id);
CREATE INDEX idx_tenants_status ON tenants(status);

CREATE TYPE document_type AS ENUM ('aadhaar', 'pan', 'student_id', 'other');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');

CREATE TABLE tenant_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type       document_type NOT NULL,
    file_url            VARCHAR(500) NOT NULL,
    verification_status verification_status NOT NULL DEFAULT 'pending',
    uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at          TIMESTAMPTZ,
    verified_by          UUID REFERENCES users(id)
);

CREATE INDEX idx_tenant_documents_tenant ON tenant_documents(tenant_id);


-- =====================================================================
-- 5. INVOICES, PAYMENTS, DEPOSITS
-- =====================================================================
-- Phase 3. Tenant "Bill Detail" wireframe: Rent / Electricity / Mess /
-- Other Charges as separate line items, Total, Due Date, Status.
-- Owner "Bills & Payments" wireframe REQUIRES partial payment support —
-- outstanding = total - sum(payments), never a binary paid/unpaid flag.

CREATE TYPE invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    pg_id           UUID NOT NULL REFERENCES pgs(id),        -- denormalized for reporting queries (Section 10 Reports)
    invoice_month   DATE NOT NULL,                            -- store as first-of-month, e.g. 2024-05-01
    total_amount    NUMERIC(10,2) NOT NULL,
    due_date        DATE NOT NULL,
    status          invoice_status NOT NULL DEFAULT 'unpaid', -- recalculated on every payment insert (app layer)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, invoice_month)
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_pg_month ON invoices(pg_id, invoice_month);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Matches the Bill Detail wireframe's exact line-item labels.
CREATE TYPE invoice_item_type AS ENUM ('rent', 'electricity', 'mess', 'other');

CREATE TABLE invoice_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_type       invoice_item_type NOT NULL,
    label           VARCHAR(100),                -- free text for "other" line items
    amount          NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Tenant wireframe "Pay Invoice": tenant states HOW they paid offline;
-- Owner confirms against bank/UPI records. No gateway integration.
CREATE TYPE payment_method AS ENUM ('upi', 'bank_transfer', 'cash', 'cheque');

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),
    amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method               payment_method NOT NULL,
    proof_url            VARCHAR(500),             -- tenant-uploaded payment proof, per MVP Notes on tenant wireframe
    recorded_by          UUID NOT NULL REFERENCES users(id),  -- owner or staff who confirmed it
    paid_on               DATE NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);

CREATE TABLE security_deposits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID UNIQUE NOT NULL REFERENCES tenants(id),
    amount          NUMERIC(10,2) NOT NULL,
    collected_on    DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- 6. COMPLAINTS
-- =====================================================================
-- Phase 4. Category is a locked 5-value enum — confirmed identically
-- across Owner, Staff, and Tenant wireframes: Electrical, Plumbing,
-- Internet, Maintenance, Other. Status flow enforces Module 4's
-- accountability rule at the application layer: only staff/owner can
-- set 'resolved'; only the tenant who raised it can 'confirm_closed'
-- or 'reopen'.

CREATE TYPE complaint_category AS ENUM
    ('electrical', 'plumbing', 'internet', 'maintenance', 'other');

CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high');

CREATE TYPE complaint_status AS ENUM
    ('open', 'assigned', 'in_progress', 'resolved', 'reopened', 'closed');

CREATE TABLE complaints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    pg_id           UUID NOT NULL REFERENCES pgs(id),        -- denormalized for staff/owner filtering
    bed_id          UUID REFERENCES beds(id),                 -- room context, shown on all 3 wireframes
    category        complaint_category NOT NULL,
    description     TEXT NOT NULL,
    photo_url       VARCHAR(500),
    priority        complaint_priority NOT NULL DEFAULT 'medium',
    status          complaint_status NOT NULL DEFAULT 'open',
    assigned_to     UUID REFERENCES users(id),                -- staff member, nullable until assigned
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaints_tenant ON complaints(tenant_id);
CREATE INDEX idx_complaints_pg ON complaints(pg_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_assigned ON complaints(assigned_to);

-- Activity timeline shown on both Staff and Tenant complaint-detail
-- wireframes (Open → In Progress → Resolved, with timestamps).
CREATE TABLE complaint_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id    UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    comment_type    VARCHAR(30) NOT NULL DEFAULT 'note',  -- 'note' | 'status_change'
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaint_comments_complaint ON complaint_comments(complaint_id);


-- =====================================================================
-- 7. MOVE-OUTS & SETTLEMENTS (with dispute support)
-- =====================================================================
-- Phase 5. This is the section that changed most from the original
-- plan doc. Owner, Staff, and Tenant wireframes ALL now show a full
-- dispute flow: tenant can flag a settlement "Disputed" with a reason;
-- it surfaces to Owner/Staff; resolution happens offline (no in-app
-- negotiation, per plan doc Module 5 decision and tenant MVP Notes:
-- "Move-out settlement can be disputed by tenant. Discussion happens
-- offline.")

CREATE TYPE moveout_status AS ENUM
    ('notice_given', 'inspection_pending', 'inspection_done',
     'settlement_pending', 'settled', 'disputed');

CREATE TABLE move_out_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID UNIQUE NOT NULL REFERENCES tenants(id),  -- one active move-out per tenant
    notice_date         DATE NOT NULL,
    expected_moveout_date DATE NOT NULL,
    reason              VARCHAR(255),                                  -- optional, shown on tenant wireframe
    status              moveout_status NOT NULL DEFAULT 'notice_given',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moveout_tenant ON move_out_requests(tenant_id);
CREATE INDEX idx_moveout_status ON move_out_requests(status);

CREATE TYPE inspection_condition AS ENUM ('good', 'minor_damage', 'major_damage');

CREATE TABLE move_out_inspections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_out_id         UUID UNIQUE NOT NULL REFERENCES move_out_requests(id) ON DELETE CASCADE,
    inspected_by         UUID NOT NULL REFERENCES users(id),  -- owner or staff
    inspected_on          DATE NOT NULL,
    overall_condition     inspection_condition NOT NULL,
    damage_notes           TEXT,
    photo_urls              TEXT[],                            -- array of photo URLs, matches wireframe's photo grid
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE settlement_status AS ENUM ('pending', 'finalized', 'disputed');

CREATE TABLE settlements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_out_id         UUID UNIQUE NOT NULL REFERENCES move_out_requests(id) ON DELETE CASCADE,
    security_deposit    NUMERIC(10,2) NOT NULL,
    -- Deduction line items match the exact wireframe breakdown:
    -- Pending Rent, Electricity, Damage Charges, Cleaning Charges
    pending_rent         NUMERIC(10,2) NOT NULL DEFAULT 0,
    electricity_charges   NUMERIC(10,2) NOT NULL DEFAULT 0,
    damage_charges         NUMERIC(10,2) NOT NULL DEFAULT 0,
    cleaning_charges        NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_deductions          NUMERIC(10,2) NOT NULL,   -- sum of the four above; computed at app layer on save
    refund_amount               NUMERIC(10,2) NOT NULL,  -- security_deposit - total_deductions
    settlement_date               DATE NOT NULL,
    status                         settlement_status NOT NULL DEFAULT 'pending',
    -- Dispute fields — directly from the Owner "Dispute Details" panel
    -- and Tenant "I Disagree with this Settlement" action.
    disputed_at                     TIMESTAMPTZ,
    disputed_by                      UUID REFERENCES users(id),   -- always the tenant, per wireframe
    dispute_reason                    TEXT,
    dispute_resolution_notes            TEXT,             -- owner fills this in after offline discussion
    created_at                            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlements_status ON settlements(status);

-- Bed vacancy on settlement finalization is a single explicit function,
-- not inline logic buried in an endpoint (per plan doc Phase 5 note).
-- See application-layer note at the bottom of this file.


-- =====================================================================
-- 8. NOTICES
-- =====================================================================
-- Both Staff and Tenant wireframes show a Notices panel
-- (Water Supply Maintenance, Electricity Maintenance, Rent Reminder).

CREATE TABLE notices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_id           UUID NOT NULL REFERENCES pgs(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(150) NOT NULL,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notices_pg ON notices(pg_id);


-- =====================================================================
-- 9. NOTIFICATIONS (in-app only — Phase 6)
-- =====================================================================
-- Section 11 Phase 6: single table, populated on the events that
-- matter most (complaint assigned/resolved, invoice generated,
-- settlement ready, settlement disputed). No push/email/SMS in MVP.

CREATE TYPE notification_event AS ENUM (
    'complaint_assigned', 'complaint_resolved', 'complaint_reopened',
    'invoice_generated', 'settlement_ready', 'settlement_disputed',
    'move_out_notice_received'
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type      notification_event NOT NULL,
    title           VARCHAR(150) NOT NULL,
    body            VARCHAR(500),
    related_id      UUID,                              -- polymorphic ref: complaint_id, invoice_id, settlement_id, etc.
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);


-- =====================================================================
-- APPLICATION-LAYER LOGIC (not enforced by schema — implement in FastAPI)
-- =====================================================================
-- These are business rules the wireframes require that a schema alone
-- cannot guarantee. Flagging them here so they aren't lost between the
-- schema and the endpoint code:
--
-- 1. ONE ACTIVE BED PER TENANT: enforce at the application layer when
--    assigning tenants.bed_id — reject if the target bed's status is
--    already 'occupied'. (A partial unique index on beds.id filtered
--    by tenant status could help, but the simplest correct approach is
--    a transaction that checks-then-assigns.)
--
-- 2. INVOICE STATUS RECALCULATION: on every INSERT into `payments`,
--    recompute invoices.status by comparing invoices.total_amount to
--    SUM(payments.amount) for that invoice. Never let the UI set
--    status directly — it must always be derived.
--
-- 3. COMPLAINT ACCOUNTABILITY RULE (Module 4): only users with role
--    'owner' or 'staff' may transition complaints.status to 'resolved'.
--    Only the tenant who owns tenant_id may transition to
--    'reopened' or a final closed state. Enforce this as a single
--    reusable permission check, not per-endpoint — this is exactly
--    the kind of rule that's easy to bypass if reimplemented twice.
--
-- 4. SETTLEMENT FINALIZATION: wrap "mark settlement finalized" and
--    "set bed status back to vacant" in one function/transaction
--    (e.g. finalize_settlement_and_vacate_bed()), not two separate
--    calls from the endpoint. This was flagged in the plan doc
--    specifically because it's the one place Module 3/5 logic reaches
--    back to mutate Module 1 (beds) data.
--
-- 5. SETTLEMENT DISPUTE: setting settlements.status = 'disputed' must
--    also populate disputed_at, disputed_by, dispute_reason together —
--    never allow a disputed status with a null reason. Resolving a
--    dispute is an Owner action: they edit dispute_resolution_notes
--    and manually move status back to 'finalized' — there is
--    intentionally no automated resolution workflow.
--
-- 6. STAFF PERMISSION CHECK: a single auth-dependency function checks
--    role == 'staff' AND pg_id IN (SELECT pg_id FROM staff_assignments
--    WHERE staff_id = current_user.id) for every PG-scoped endpoint.
--    This is the ONE place staff access is gated — do not reimplement
--    this check per-route, and do not add per-permission flags until
--    the staff_permissions table is actually built post-MVP.
--
-- 7. REPORTS QUERIES (Section 11, 3 fixed views only):
--    - Collection Summary: SUM(invoices.total_amount) vs
--      SUM(payments.amount) grouped by pg_id + invoice_month.
--    - Occupancy Over Time: COUNT(beds WHERE status='occupied') vs
--      COUNT(beds) sampled monthly — needs either a scheduled snapshot
--      table or computed from tenants.move_in_date / move_out history
--      at query time. Decide which before Phase 6.
--    - Complaint Turnaround: AVG(resolved_at - created_at) from
--      complaint_comments where comment_type='status_change' and the
--      new status was 'resolved', grouped by pg_id, last 30 days.
-- =====================================================================