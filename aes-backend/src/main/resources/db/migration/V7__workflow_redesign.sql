-- ============================================================
-- AES Customer Portal · V7 — Workflow Re-Design (Phase 1)
--
-- Purpose: lay the schema + seed foundation for the corrected
-- workflow described in PLAN.md and FLOW.md.
--   • new roles OPS_MANAGER and SITE_ENGINEER
--   • staff_profiles (shift, skills, locality, workload caps)
--   • assignment_offers (the OFFERED → ACCEPTED/DECLINED/EXPIRED loop
--     used for both CRM ownership and engineer dispatch)
--   • quotes (installations + P3 estimates)
--   • ticket_notes (CRM call log)
--   • extend service_tickets + installation_requests with triage and
--     engineer-dispatch columns
--   • widen service_tickets.status so the longer status values added
--     to TicketStatus.java fit
--
-- Strictly additive — does NOT modify or delete any existing rows or
-- columns. Existing demo tickets/installations keep working exactly as
-- they do today.
-- ============================================================

-- ─── 1) Widen status column to fit new TicketStatus values ─────
-- Old: VARCHAR(20). Longest new value is WAITING_CUSTOMER_APPROVAL (26).
-- We widen to VARCHAR(32) for headroom.
ALTER TABLE service_tickets
    ALTER COLUMN status TYPE VARCHAR(32);


-- ─── 2) Triage + dispatch columns on service_tickets ──────────
ALTER TABLE service_tickets
    ADD COLUMN IF NOT EXISTS triage_at             TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triaged_by            UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS engineer_id           UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS engineer_accepted_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS en_route_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS on_site_at            TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS branch                VARCHAR(50)  DEFAULT 'HYDERABAD',
    ADD COLUMN IF NOT EXISTS locality              VARCHAR(100),
    ADD COLUMN IF NOT EXISTS escalation_reason     VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_service_tickets_triage_pending
    ON service_tickets(created_at)
    WHERE current_assignee_id IS NULL AND status NOT IN ('CLOSED','CANCELLED');

CREATE INDEX IF NOT EXISTS idx_service_tickets_engineer
    ON service_tickets(engineer_id)
    WHERE engineer_id IS NOT NULL;


-- ─── 3) Triage + dispatch columns on installation_requests ────
ALTER TABLE installation_requests
    ADD COLUMN IF NOT EXISTS triage_at               TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triaged_by              UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS owner_crm_id            UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS site_visit_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS site_visit_engineer_id  UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS lead_engineer_id        UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS branch                  VARCHAR(50) DEFAULT 'HYDERABAD',
    ADD COLUMN IF NOT EXISTS locality                VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_installations_triage_pending
    ON installation_requests(created_at)
    WHERE owner_crm_id IS NULL AND status NOT IN ('COMPLETED','CANCELLED');


-- ─── 4) staff_profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    branch                  VARCHAR(50)  NOT NULL DEFAULT 'HYDERABAD',
    on_shift                BOOLEAN      NOT NULL DEFAULT FALSE,
    shift_start             TIME,
    shift_end               TIME,
    skills                  TEXT[],
    localities              TEXT[],
    max_concurrent_load     INT          NOT NULL DEFAULT 8,
    avg_resolution_minutes  INT,
    csat_score              NUMERIC(3,2),
    last_seen_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_shift
    ON staff_profiles(branch, on_shift);


-- ─── 5) assignment_offers ─────────────────────────────────────
-- The OFFERED → ACCEPTED / DECLINED / EXPIRED / WITHDRAWN lifecycle.
-- Used for BOTH:
--   • CRM_OWNER       — Ops Manager offers a ticket / install to a CRM
--   • ENGINEER_DISPATCH — CRM (or SM) offers dispatch to a site engineer
CREATE TABLE IF NOT EXISTS assignment_offers (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID         REFERENCES service_tickets(id) ON DELETE CASCADE,
    install_id      UUID         REFERENCES installation_requests(id) ON DELETE CASCADE,
    offered_to      UUID         NOT NULL REFERENCES users(id),
    offered_by      UUID         NOT NULL REFERENCES users(id),
    offer_type      VARCHAR(30)  NOT NULL,           -- CRM_OWNER | ENGINEER_DISPATCH
    mode            VARCHAR(20)  NOT NULL DEFAULT 'DIRECT', -- DIRECT | INVITE
    note            TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'OFFERED', -- OFFERED|ACCEPTED|DECLINED|EXPIRED|WITHDRAWN
    decline_reason  TEXT,
    expires_at      TIMESTAMPTZ  NOT NULL,
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Exactly one of ticket_id / install_id must be present.
    CONSTRAINT chk_offers_target CHECK (
        (ticket_id IS NOT NULL)::int + (install_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_offers_offered_to_status
    ON assignment_offers(offered_to, status);

CREATE INDEX IF NOT EXISTS idx_offers_ticket
    ON assignment_offers(ticket_id) WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offers_install
    ON assignment_offers(install_id) WHERE install_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offers_expiry
    ON assignment_offers(expires_at) WHERE status = 'OFFERED';


-- ─── 6) quotes ────────────────────────────────────────────────
-- One row per quote version. Installations can have multiple versions
-- (negotiation rounds); P3 service tickets typically have one.
CREATE TABLE IF NOT EXISTS quotes (
    id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number          VARCHAR(30)   NOT NULL UNIQUE,
    install_id            UUID          REFERENCES installation_requests(id) ON DELETE CASCADE,
    ticket_id             UUID          REFERENCES service_tickets(id) ON DELETE CASCADE,
    version               INT           NOT NULL DEFAULT 1,
    line_items_json       JSONB         NOT NULL DEFAULT '[]'::jsonb,
    subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount              NUMERIC(12,2) NOT NULL DEFAULT 0,
    total                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    valid_until           DATE,
    status                VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | PENDING_APPROVAL | APPROVED | REJECTED_INTERNAL
    -- | SENT_TO_CUSTOMER | CUSTOMER_ACCEPTED | CUSTOMER_REJECTED
    -- | NEGOTIATING | SUPERSEDED
    prepared_by           UUID          REFERENCES users(id),
    approved_by           UUID          REFERENCES users(id),
    approved_at           TIMESTAMPTZ,
    sent_at               TIMESTAMPTZ,
    customer_decision     VARCHAR(20),
    customer_decided_at   TIMESTAMPTZ,
    customer_response     TEXT,
    notes                 TEXT,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_quotes_target CHECK (
        (install_id IS NOT NULL)::int + (ticket_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_quotes_install ON quotes(install_id) WHERE install_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_ticket  ON quotes(ticket_id)  WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_status  ON quotes(status);

CREATE SEQUENCE IF NOT EXISTS quote_seq START 1;


-- ─── 7) ticket_notes (CRM call log + internal notes) ──────────
CREATE TABLE IF NOT EXISTS ticket_notes (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id   UUID         NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    author_id   UUID         NOT NULL REFERENCES users(id),
    note_type   VARCHAR(20)  NOT NULL DEFAULT 'INTERNAL',
    -- INTERNAL | CUSTOMER_CALL | SMS | WHATSAPP | EMAIL
    body        TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket
    ON ticket_notes(ticket_id, created_at DESC);


-- ============================================================
-- 8) SEED — new roles (Ops Manager + Site Engineers)
-- ============================================================
-- BCrypt hash of "password123" (strength 12) — re-used from V3/V4.

INSERT INTO users (id, phone_number, name, email, role, password_hash, is_active, created_at) VALUES
  -- Ops Manager (the human dispatcher) ------------------------------------
  ('20000001-0000-0000-0000-000000000001', '+919000066666', 'Meera Nair',
   'meera.ops@aes.com', 'OPS_MANAGER',
   '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO',
   TRUE, NOW() - INTERVAL '400 days'),

  -- Site Engineers (the field technicians) -------------------------------
  ('30000001-0000-0000-0000-000000000001', '+919000077777', 'Rajesh Verma',
   'rajesh.eng@aes.com', 'SITE_ENGINEER',
   '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO',
   TRUE, NOW() - INTERVAL '300 days'),

  ('30000002-0000-0000-0000-000000000002', '+919000088888', 'Imran Khan',
   'imran.eng@aes.com', 'SITE_ENGINEER',
   '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO',
   TRUE, NOW() - INTERVAL '300 days'),

  ('30000003-0000-0000-0000-000000000003', '+919000099999', 'Sandeep Rao',
   'sandeep.eng@aes.com', 'SITE_ENGINEER',
   '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO',
   TRUE, NOW() - INTERVAL '300 days')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 9) SEED — staff_profiles for every staff member
-- ============================================================
-- On-shift flags + skill matrices so the workload board has data to show.

INSERT INTO staff_profiles (user_id, branch, on_shift, shift_start, shift_end,
                            skills, localities, max_concurrent_load, avg_resolution_minutes, csat_score)
VALUES
  -- Ops Manager — Meera (always on-shift during business hours)
  ('20000001-0000-0000-0000-000000000001', 'HYDERABAD', TRUE,
   '09:00', '20:00',
   ARRAY['TRIAGE','DISPATCH']::TEXT[],
   ARRAY['HYDERABAD']::TEXT[],
   50, NULL, NULL),

  -- CRM agents
  ('b0000001-0000-0000-0000-000000000001', 'HYDERABAD', TRUE,
   '09:00', '18:00',
   ARRAY['SPLIT','CASSETTE','VRF']::TEXT[],
   ARRAY['JUBILEE_HILLS','BANJARA_HILLS','MADHURA_NAGAR']::TEXT[],
   8, 168, 4.6),

  ('b0000002-0000-0000-0000-000000000002', 'HYDERABAD', TRUE,
   '10:00', '19:00',
   ARRAY['SPLIT','CASSETTE','CHILLER']::TEXT[],
   ARRAY['MADHAPUR','GACHIBOWLI','HITECH_CITY']::TEXT[],
   8, 142, 4.7),

  -- Service Managers
  ('c0000001-0000-0000-0000-000000000001', 'HYDERABAD', TRUE,
   '09:00', '19:00',
   ARRAY['ALL']::TEXT[],
   ARRAY['HYDERABAD']::TEXT[],
   20, 240, 4.8),

  ('c0000002-0000-0000-0000-000000000002', 'HYDERABAD', TRUE,
   '10:00', '20:00',
   ARRAY['ALL']::TEXT[],
   ARRAY['HYDERABAD']::TEXT[],
   20, 220, 4.7),

  -- Admin
  ('d0000001-0000-0000-0000-000000000001', 'HYDERABAD', TRUE,
   '08:00', '22:00',
   ARRAY['ALL']::TEXT[],
   ARRAY['HYDERABAD']::TEXT[],
   100, NULL, NULL),

  -- Site Engineers (skill + locality matrix per FLOW.md design)
  ('30000001-0000-0000-0000-000000000001', 'HYDERABAD', TRUE,
   '08:30', '18:30',
   ARRAY['SPLIT','VRF','VRF_VRV']::TEXT[],
   ARRAY['JUBILEE_HILLS','GACHIBOWLI','BANJARA_HILLS']::TEXT[],
   4, 95, 4.8),

  ('30000002-0000-0000-0000-000000000002', 'HYDERABAD', TRUE,
   '09:00', '19:00',
   ARRAY['CASSETTE','CHILLER','CENTRAL']::TEXT[],
   ARRAY['MADHAPUR','HITECH_CITY','KONDAPUR']::TEXT[],
   4, 110, 4.7),

  ('30000003-0000-0000-0000-000000000003', 'HYDERABAD', TRUE,
   '08:00', '20:00',
   ARRAY['SPLIT','CASSETTE','VRF','VRF_VRV','CENTRAL','WINDOW']::TEXT[],
   ARRAY['BANJARA_HILLS','BEGUMPET','MADHURA_NAGAR','HYDERABAD']::TEXT[],
   5, 105, 4.9)
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================
-- 10) SEED — backfill triage + branch on existing demo tickets
-- ============================================================
-- The V4/V6 demo tickets pre-date the workflow re-design. Marking them
-- as "already triaged by Meera" keeps every demo screen consistent
-- with the new model without rewriting the seed.

UPDATE service_tickets
   SET triage_at  = COALESCE(triage_at, created_at),
       triaged_by = COALESCE(triaged_by, '20000001-0000-0000-0000-000000000001'),
       branch     = COALESCE(branch, 'HYDERABAD'),
       locality   = COALESCE(locality,
            CASE
              WHEN property_id = 'e0000001-0000-0000-0000-000000000001' THEN 'JUBILEE_HILLS'
              WHEN property_id = 'e0000003-0000-0000-0000-000000000003' THEN 'MADHAPUR'
              WHEN property_id = 'e0000004-0000-0000-0000-000000000004' THEN 'MADHAPUR'
              WHEN property_id = 'e0000005-0000-0000-0000-000000000005' THEN 'BANJARA_HILLS'
              WHEN property_id = 'e0000002-0000-0000-0000-000000000002' THEN 'KONDAPUR'
              ELSE 'HYDERABAD'
            END)
 WHERE current_assignee_id IS NOT NULL;

UPDATE installation_requests
   SET triage_at  = COALESCE(triage_at, created_at),
       triaged_by = COALESCE(triaged_by, '20000001-0000-0000-0000-000000000001'),
       owner_crm_id = COALESCE(owner_crm_id, assigned_engineer_id),
       branch     = COALESCE(branch, 'HYDERABAD'),
       locality   = COALESCE(locality,
            CASE
              WHEN property_id = 'e0000001-0000-0000-0000-000000000001' THEN 'JUBILEE_HILLS'
              WHEN property_id = 'e0000003-0000-0000-0000-000000000003' THEN 'MADHAPUR'
              WHEN property_id = 'e0000005-0000-0000-0000-000000000005' THEN 'BANJARA_HILLS'
              WHEN property_id = 'e0000002-0000-0000-0000-000000000002' THEN 'KONDAPUR'
              ELSE 'HYDERABAD'
            END);


-- ============================================================
-- 11) Welcome notifications for the brand-new staff
-- ============================================================
INSERT INTO notifications (id, user_id, title, body, type, reference_id,
                            reference_type, is_read, sent_sms, created_at)
VALUES
  ('1ff00040-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001',
   'Welcome, Meera', 'Your Ops Manager dashboard at /ops is ready. New tickets and installs land here first for triage.',
   'TICKET_ASSIGNED', NULL, NULL, FALSE, FALSE, NOW() - INTERVAL '1 hour'),

  ('1ff00050-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001',
   'Welcome, Rajesh', 'You are now an active site engineer for AES. Skills: Split, VRF/VRV. Locality: Jubilee Hills, Gachibowli, Banjara Hills.',
   'TICKET_ASSIGNED', NULL, NULL, FALSE, FALSE, NOW() - INTERVAL '1 hour'),

  ('1ff00050-0000-0000-0000-000000000002', '30000002-0000-0000-0000-000000000002',
   'Welcome, Imran', 'You are now an active site engineer for AES. Skills: Cassette, Chiller, Central. Locality: Madhapur, Hitech City, Kondapur.',
   'TICKET_ASSIGNED', NULL, NULL, FALSE, FALSE, NOW() - INTERVAL '1 hour'),

  ('1ff00050-0000-0000-0000-000000000003', '30000003-0000-0000-0000-000000000003',
   'Welcome, Sandeep', 'You are now an active site engineer for AES. All-rounder. Locality: Banjara, Begumpet, Madhura Nagar.',
   'TICKET_ASSIGNED', NULL, NULL, FALSE, FALSE, NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;
