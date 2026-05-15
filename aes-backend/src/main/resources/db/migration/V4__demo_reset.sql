-- ============================================================
-- AES Customer Portal — V4 Demo Reset & Realistic Seed Data
--
-- Wipes every transactional row and replaces it with a coherent,
-- realistic dataset built for live demos.  Each customer is
-- intentionally placed at a different lifecycle stage so the
-- demo can showcase every screen.
--
-- Pairs with: DEMO_GUIDE.md, DEMO_CREDENTIALS.md
-- ============================================================

-- ─── 1. Truncate everything (FK-safe via CASCADE) ──────────
TRUNCATE TABLE
    notifications,
    ticket_activities,
    ticket_escalation_log,
    part_requests,
    service_tickets,
    installation_requests,
    amc_visits,
    ac_units,
    amc_contracts,
    properties,
    refresh_tokens,
    otp_tokens,
    users
RESTART IDENTITY CASCADE;

ALTER SEQUENCE ticket_seq RESTART WITH 1100;
ALTER SEQUENCE installation_req_seq RESTART WITH 2100;

-- BCrypt hash of "password123" (strength 12)
-- (same hash already used by V3 — re-used here for staff rows.)

-- ============================================================
-- 2. USERS  (5 customers · 5 staff)
-- ============================================================
-- Customer phone numbers reflect the user's spec ("123456789" …
-- "523456789") prefixed with a leading 9 so they are valid
-- 10-digit Indian mobile numbers (start with 6/7/8/9).

INSERT INTO users (id, phone_number, name, email, role, password_hash, is_active, created_at) VALUES
  -- Customers ----------------------------------------------------------------
  ('a0000001-0000-0000-0000-000000000001', '+919123456789', 'User 1 — Aarav Reddy',  'aarav@example.com',  'CUSTOMER', NULL, TRUE, NOW() - INTERVAL '420 days'),
  ('a0000002-0000-0000-0000-000000000002', '+919223456789', 'User 2 — Priya Sharma', 'priya@example.com',  'CUSTOMER', NULL, TRUE, NOW() - INTERVAL '2 days'),
  ('a0000003-0000-0000-0000-000000000003', '+919323456789', 'User 3 — Karan Patel',  'karan@example.com',  'CUSTOMER', NULL, TRUE, NOW() - INTERVAL '210 days'),
  ('a0000004-0000-0000-0000-000000000004', '+919423456789', 'User 4 — Sneha Iyer',   'sneha@example.com',  'CUSTOMER', NULL, TRUE, NOW() - INTERVAL '95 days'),
  ('a0000005-0000-0000-0000-000000000005', '+919523456789', 'User 5 — Vikram Singh', 'vikram@example.com', 'CUSTOMER', NULL, TRUE, NOW() - INTERVAL '650 days'),

  -- CRM team (Level 1 - first response) -------------------------------------
  ('b0000001-0000-0000-0000-000000000001', '+919000011111', 'Ravi Kumar',   'ravi.crm@aes.com',    'CRM_AGENT',
    '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO', TRUE, NOW() - INTERVAL '500 days'),
  ('b0000002-0000-0000-0000-000000000002', '+919000022222', 'Lakshmi Nair', 'lakshmi.crm@aes.com', 'CRM_AGENT',
    '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO', TRUE, NOW() - INTERVAL '500 days'),

  -- Service team (Level 2 - escalations & engineering) ----------------------
  ('c0000001-0000-0000-0000-000000000001', '+919000033333', 'Suresh Babu',  'suresh.svc@aes.com',  'SERVICE_MANAGER',
    '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO', TRUE, NOW() - INTERVAL '500 days'),
  ('c0000002-0000-0000-0000-000000000002', '+919000044444', 'Deepa Iyer',   'deepa.svc@aes.com',   'SERVICE_MANAGER',
    '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO', TRUE, NOW() - INTERVAL '500 days'),

  -- Management (Level 3 - admin / executive) --------------------------------
  ('d0000001-0000-0000-0000-000000000001', '+919000055555', 'Anand Rao',    'anand.admin@aes.com', 'ADMIN',
    '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO', TRUE, NOW() - INTERVAL '500 days');


-- ============================================================
-- 3. PROPERTIES  (one primary per customer; mirrors AES space types)
-- ============================================================
INSERT INTO properties (id, customer_id, label, address_line1, address_line2, city, pincode, property_type, is_primary, created_at) VALUES
  ('e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   'Villa #42 — Aarav', 'Plot 42, Road No. 10, Jubilee Hills', NULL, 'Hyderabad', '500033', 'RESIDENTIAL', TRUE, NOW() - INTERVAL '420 days'),

  ('e0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002',
   'Apartment 12B', 'My Home Bhooja, Tower 4, Kondapur', '12B', 'Hyderabad', '500084', 'RESIDENTIAL', TRUE, NOW() - INTERVAL '2 days'),

  ('e0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003',
   'iSprout Office', 'iSprout Hitech City, Madhapur',  '4th floor', 'Hyderabad', '500081', 'COMMERCIAL', TRUE, NOW() - INTERVAL '210 days'),

  ('e0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004',
   'Adarsha Hospital', 'Plot 7, Madhapur Main Road', 'Block A',     'Hyderabad', '500081', 'HOSPITAL',  TRUE, NOW() - INTERVAL '95 days'),

  ('e0000005-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005',
   'Tabla Restaurant', 'Banjara Hills, Road No. 12',  'Ground floor','Hyderabad', '500034', 'HOTEL',     TRUE, NOW() - INTERVAL '650 days');


-- ============================================================
-- 4. AMC CONTRACTS  (user1 + user5)
-- ============================================================
INSERT INTO amc_contracts (id, customer_id, property_id, contract_number, start_date, end_date, visits_per_year, visits_completed, is_active, contract_value, notes, created_at) VALUES
  ('f0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'AMC-2025-0001',
   CURRENT_DATE - INTERVAL '180 days',
   CURRENT_DATE + INTERVAL '185 days',
   4, 2, TRUE, 24000.00, 'Premium villa AMC — covers 4 split units + 1 cassette.',
   NOW() - INTERVAL '180 days'),

  ('f0000002-0000-0000-0000-000000000002',
   'a0000005-0000-0000-0000-000000000005',
   'e0000005-0000-0000-0000-000000000005',
   'AMC-2026-0007',
   CURRENT_DATE - INTERVAL '14 days',
   CURRENT_DATE + INTERVAL '351 days',
   4, 0, TRUE, 36000.00, 'VRF AMC — 1 outdoor + 4 indoor units, restaurant kitchen ventilation.',
   NOW() - INTERVAL '14 days');


-- ============================================================
-- 5. AC UNITS   (per customer)
-- ============================================================
-- user1 — 4 ACs in the villa (all on AMC)
INSERT INTO ac_units (id, property_id, customer_id, room_label, ac_type, brand, model_number, tonnage, energy_star_rating, installation_date, warranty_expiry, amc_contract_id, warranty_status, service_status) VALUES
  ('a1c00001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   'Master Bedroom', 'SPLIT', 'Mitsubishi Electric', 'MSY-FV13VF', 1.5, 5,
   CURRENT_DATE - INTERVAL '380 days', CURRENT_DATE + INTERVAL '350 days',
   'f0000001-0000-0000-0000-000000000001', 'IN_WARRANTY', 'P1_AMC'),

  ('a1c00002-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   'Living Room',    'CASSETTE', 'Daikin', 'FCQG24AVMV', 2.0, 4,
   CURRENT_DATE - INTERVAL '380 days', CURRENT_DATE + INTERVAL '350 days',
   'f0000001-0000-0000-0000-000000000001', 'IN_WARRANTY', 'P1_AMC'),

  ('a1c00003-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   'Guest Room',     'SPLIT', 'LG', 'RS-Q12YNZE', 1.0, 5,
   CURRENT_DATE - INTERVAL '300 days', CURRENT_DATE + INTERVAL '430 days',
   'f0000001-0000-0000-0000-000000000001', 'IN_WARRANTY', 'P1_AMC'),

  ('a1c00004-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   'Study Room',     'SPLIT', 'Hitachi', 'RSOS512HCEA', 1.0, 5,
   CURRENT_DATE - INTERVAL '180 days', CURRENT_DATE + INTERVAL '550 days',
   'f0000001-0000-0000-0000-000000000001', 'IN_WARRANTY', 'P1_AMC'),

-- user3 — 3 ACs in iSprout office (warranty only, no AMC)
  ('a3c00001-0000-0000-0000-000000000001', 'e0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003',
   'Open Workspace 1', 'CASSETTE', 'Hitachi', 'RAS-2.5JR6CK', 2.5, 5,
   CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '610 days',
   NULL, 'IN_WARRANTY', 'P2_WARRANTY'),

  ('a3c00002-0000-0000-0000-000000000002', 'e0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003',
   'Open Workspace 2', 'CASSETTE', 'Hitachi', 'RAS-2.5JR6CK', 2.5, 5,
   CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '610 days',
   NULL, 'IN_WARRANTY', 'P2_WARRANTY'),

  ('a3c00003-0000-0000-0000-000000000003', 'e0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003',
   'Conference Room',  'SPLIT', 'Toshiba', 'RAS-18NCV2KCV', 1.5, 5,
   CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '610 days',
   NULL, 'IN_WARRANTY', 'P2_WARRANTY'),

-- user4 — 3 ductable units in the hospital (out of warranty, paid service)
  ('a4c00001-0000-0000-0000-000000000001', 'e0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004',
   'OPD Hall',  'CENTRAL', 'Carrier', 'XPower 11kW', 4.0, 4,
   CURRENT_DATE - INTERVAL '900 days', CURRENT_DATE - INTERVAL '170 days',
   NULL, 'EXPIRED', 'P3_PAID'),

  ('a4c00002-0000-0000-0000-000000000002', 'e0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004',
   'ICU',       'CENTRAL', 'Carrier', 'XPower 11kW', 4.0, 4,
   CURRENT_DATE - INTERVAL '900 days', CURRENT_DATE - INTERVAL '170 days',
   NULL, 'EXPIRED', 'P3_PAID'),

  ('a4c00003-0000-0000-0000-000000000003', 'e0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004',
   'Reception','CASSETTE', 'Blue Star', 'IC524YNUA', 2.0, 5,
   CURRENT_DATE - INTERVAL '600 days', CURRENT_DATE + INTERVAL '130 days',
   NULL, 'IN_WARRANTY', 'P3_PAID'),

-- user5 — 1 VRF outdoor (modeled as VRF unit) + 1 cassette in private dining
  ('a5c00001-0000-0000-0000-000000000001', 'e0000005-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005',
   'Main Hall (VRF)',     'VRF_VRV', 'Mitsubishi Electric', 'PUMY-P140VKM3', 8.0, 5,
   CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '716 days',
   'f0000002-0000-0000-0000-000000000002', 'IN_WARRANTY', 'P1_AMC'),

  ('a5c00002-0000-0000-0000-000000000002', 'e0000005-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005',
   'Private Dining',      'CASSETTE', 'LG', 'ATNQ24GPLE7', 2.0, 5,
   CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '716 days',
   'f0000002-0000-0000-0000-000000000002', 'IN_WARRANTY', 'P1_AMC');


-- ============================================================
-- 6. AMC VISITS  (visit history + upcoming)
-- ============================================================
INSERT INTO amc_visits (id, contract_id, visit_number, scheduled_date, scheduled_time_slot, actual_visit_date, engineer_id, status, notes) VALUES
  -- user1 contract — visits 1 & 2 done, 3 upcoming, 4 future
  ('aab00001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 1, CURRENT_DATE - INTERVAL '150 days', 'MORNING',
   NOW() - INTERVAL '150 days', 'c0000001-0000-0000-0000-000000000001', 'COMPLETED', 'Coil clean + gas top-up.'),
  ('aab00002-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 2, CURRENT_DATE - INTERVAL '60 days', 'AFTERNOON',
   NOW() - INTERVAL '60 days',  'c0000001-0000-0000-0000-000000000001', 'COMPLETED', 'Filter replacement, drain pipe flush.'),
  ('aab00003-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 3, CURRENT_DATE + INTERVAL '5 days',  'MORNING',
   NULL, 'c0000001-0000-0000-0000-000000000001', 'SCHEDULED', NULL),
  ('aab00004-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 4, CURRENT_DATE + INTERVAL '95 days', 'MORNING',
   NULL, NULL, 'SCHEDULED', NULL),

  -- user5 contract — first visit upcoming
  ('aab00005-0000-0000-0000-000000000002', 'f0000002-0000-0000-0000-000000000002', 1, CURRENT_DATE + INTERVAL '76 days', 'AFTERNOON',
   NULL, 'c0000002-0000-0000-0000-000000000002', 'SCHEDULED', NULL),
  ('aab00006-0000-0000-0000-000000000002', 'f0000002-0000-0000-0000-000000000002', 2, CURRENT_DATE + INTERVAL '170 days', 'MORNING',
   NULL, NULL, 'SCHEDULED', NULL),
  ('aab00007-0000-0000-0000-000000000002', 'f0000002-0000-0000-0000-000000000002', 3, CURRENT_DATE + INTERVAL '260 days', 'MORNING',
   NULL, NULL, 'SCHEDULED', NULL),
  ('aab00008-0000-0000-0000-000000000002', 'f0000002-0000-0000-0000-000000000002', 4, CURRENT_DATE + INTERVAL '350 days', 'MORNING',
   NULL, NULL, 'SCHEDULED', NULL);


-- ============================================================
-- 7. INSTALLATION REQUESTS  (cover every status)
-- ============================================================
INSERT INTO installation_requests (id, request_number, customer_id, property_id, property_address, ac_type, brand, model_number, tonnage, energy_rating, rooms_json, scheduled_date, scheduled_slot, status, assigned_engineer_id, estimated_cost, notes, created_at) VALUES
  -- user2 — fresh request, awaiting CRM call
  ('aac00001-0000-0000-0000-000000000001', 'INS-2026-2101',
   'a0000002-0000-0000-0000-000000000002', 'e0000002-0000-0000-0000-000000000002', NULL,
   'SPLIT', 'Daikin', 'FTKM50UV', 1.5, 5,
   '[{"roomType":"Master Bedroom","sizeSqft":180,"acType":"SPLIT"}]'::jsonb,
   CURRENT_DATE + INTERVAL '2 days', 'MORNING',
   'PENDING', NULL, 52490.00,
   '[Space: RESIDENTIAL] First AC for the new apartment — Daikin 5-star inverter recommended online.',
   NOW() - INTERVAL '1 day'),

  -- user3 — confirmed by CRM, site-visit booked
  ('aac00002-0000-0000-0000-000000000002', 'INS-2026-2102',
   'a0000003-0000-0000-0000-000000000003', 'e0000003-0000-0000-0000-000000000003', NULL,
   'CASSETTE', 'Hitachi', 'RAS-2.5JR6CK', 2.5, 5,
   '[{"roomType":"Conference Room","sizeSqft":420,"acType":"CASSETTE"}]'::jsonb,
   CURRENT_DATE + INTERVAL '4 days', 'AFTERNOON',
   'CONFIRMED', 'c0000001-0000-0000-0000-000000000001', 64990.00,
   '[Space: COMMERCIAL] Adding one more cassette to match existing two units.',
   NOW() - INTERVAL '3 days'),

  -- user5 — historical, completed installation 2 weeks ago
  ('aac00003-0000-0000-0000-000000000003', 'INS-2026-2103',
   'a0000005-0000-0000-0000-000000000005', 'e0000005-0000-0000-0000-000000000005', NULL,
   'VRF_VRV', 'Mitsubishi Electric', 'PUMY-P140VKM3', 8.0, 5,
   '[{"roomType":"Main Hall","sizeSqft":1800,"acType":"VRF_VRV"},{"roomType":"Private Dining","sizeSqft":260,"acType":"CASSETTE"}]'::jsonb,
   CURRENT_DATE - INTERVAL '14 days', 'MORNING',
   'COMPLETED', 'c0000001-0000-0000-0000-000000000001', 685000.00,
   '[Space: HOTEL] Restaurant VRF + cassette installation, AMC bundled.',
   NOW() - INTERVAL '20 days'),

  -- user1 — quote sent, awaiting acceptance
  ('aac00004-0000-0000-0000-000000000004', 'INS-2026-2104',
   'a0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', NULL,
   'SPLIT', 'Mitsubishi Electric', 'MSY-FV10VF', 1.0, 5,
   '[{"roomType":"Home Office","sizeSqft":140,"acType":"SPLIT"}]'::jsonb,
   CURRENT_DATE + INTERVAL '7 days', 'MORNING',
   'QUOTE_SENT', 'c0000002-0000-0000-0000-000000000002', 46990.00,
   '[Space: RESIDENTIAL] New home office on the second floor.',
   NOW() - INTERVAL '5 days');


-- ============================================================
-- 8. SERVICE TICKETS  — every state, every priority
-- ============================================================
-- Convention for ticket numbering: AES-YYYY-NNN (we'll pre-allocate
-- 1100..1106 manually so the seq stays usable for new tickets.)

INSERT INTO service_tickets (
    id, ticket_number, customer_id, property_id, ac_unit_id,
    priority, service_type, problem_category, problem_description,
    photos_json,
    current_level, current_assignee_id, assigned_at,
    status,
    sla_deadline_l1, sla_deadline_l2, sla_deadline_final,
    acknowledged_at, resolved_at, closed_at,
    estimated_charge, final_charge, charge_accepted,
    customer_rating, customer_feedback,
    created_at, updated_at
) VALUES

-- ── AES-2026-1100  user1 · RESOLVED 30 days ago · 5★ ─────────────────────
('11000000-0000-0000-0000-000000000001', 'AES-2026-1100',
 'a0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
 'a1c00001-0000-0000-0000-000000000001',
 'P1', 'AMC', 'NOT_COOLING',
 'Master bedroom AC stopped cooling after a power surge.',
 '[]'::jsonb,
 1, 'c0000001-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days 9 hours',
 'CLOSED',
 NOW() - INTERVAL '30 days 9 hours 30 min',
 NULL,
 NOW() - INTERVAL '30 days' + INTERVAL '4 hours',
 NOW() - INTERVAL '30 days 9 hours 12 min',
 NOW() - INTERVAL '30 days 7 hours',
 NOW() - INTERVAL '29 days',
 NULL, NULL, NULL,
 5, 'Suresh fixed it the same evening — nice service.',
 NOW() - INTERVAL '30 days 10 hours', NOW() - INTERVAL '29 days'),

-- ── AES-2026-1101  user1 · RESOLVED 21 days ago · escalated L1→L2→resolved ──
('11000000-0000-0000-0000-000000000002', 'AES-2026-1101',
 'a0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001',
 'a1c00002-0000-0000-0000-000000000002',
 'P1', 'AMC', 'LEAKING',
 'Living-room cassette was dripping water onto the dining table.',
 '[]'::jsonb,
 2, 'c0000001-0000-0000-0000-000000000001', NOW() - INTERVAL '21 days 5 hours',
 'CLOSED',
 NOW() - INTERVAL '22 days', NOW() - INTERVAL '21 days 18 hours',
 NOW() - INTERVAL '20 days' + INTERVAL '4 hours',
 NOW() - INTERVAL '21 days 23 hours',
 NOW() - INTERVAL '20 days 14 hours',
 NOW() - INTERVAL '19 days',
 NULL, NULL, NULL,
 4, 'Took a day longer than expected but the team kept me posted.',
 NOW() - INTERVAL '22 days', NOW() - INTERVAL '19 days'),

-- ── AES-2026-1102  user3 · OPEN at L1 (PRIMARY DEMO TARGET — escalate live) ──
('11000000-0000-0000-0000-000000000003', 'AES-2026-1102',
 'a0000003-0000-0000-0000-000000000003', 'e0000003-0000-0000-0000-000000000003',
 'a3c00001-0000-0000-0000-000000000001',
 'P3', 'PAID', 'NOT_COOLING',
 'Cassette in Open Workspace 1 is blowing warm air since this morning. Office unusable.',
 '[]'::jsonb,
 1, 'b0000001-0000-0000-0000-000000000001', NOW() - INTERVAL '30 minutes',
 'OPEN',
 NOW() - INTERVAL '30 minutes' + INTERVAL '30 minutes',
 NULL,
 NOW() + INTERVAL '47 hours 30 minutes',
 NULL, NULL, NULL,
 1500.00, NULL, NULL,
 NULL, NULL,
 NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'),

-- ── AES-2026-1103  user4 · IN_PROGRESS at L2 (already-escalated state) ───
('11000000-0000-0000-0000-000000000004', 'AES-2026-1103',
 'a0000004-0000-0000-0000-000000000004', 'e0000004-0000-0000-0000-000000000004',
 'a4c00002-0000-0000-0000-000000000002',
 'P3', 'PAID', 'LEAKING',
 'ICU ductable AC has been leaking since yesterday. Critical care space — needs urgent fix.',
 '[]'::jsonb,
 2, 'c0000001-0000-0000-0000-000000000001', NOW() - INTERVAL '14 hours',
 'IN_PROGRESS',
 NOW() - INTERVAL '24 hours' + INTERVAL '30 minutes',
 NOW() - INTERVAL '14 hours' + INTERVAL '60 minutes',
 NOW() + INTERVAL '34 hours',
 NOW() - INTERVAL '13 hours 40 minutes',
 NULL, NULL,
 4500.00, NULL, NULL,
 NULL, NULL,
 NOW() - INTERVAL '24 hours', NOW() - INTERVAL '13 hours 40 minutes'),

-- ── AES-2026-1104  user5 · CLOSED 45 days ago · 5★ ─────────────────────
('11000000-0000-0000-0000-000000000005', 'AES-2026-1104',
 'a0000005-0000-0000-0000-000000000005', 'e0000005-0000-0000-0000-000000000005',
 'a5c00002-0000-0000-0000-000000000002',
 'P2', 'WARRANTY', 'REMOTE_WIFI',
 'Remote control would not pair with the cassette after a firmware update.',
 '[]'::jsonb,
 1, 'b0000002-0000-0000-0000-000000000002', NOW() - INTERVAL '45 days 10 hours',
 'CLOSED',
 NOW() - INTERVAL '46 days', NULL,
 NOW() - INTERVAL '45 days' + INTERVAL '4 hours',
 NOW() - INTERVAL '45 days 9 hours',
 NOW() - INTERVAL '45 days 4 hours',
 NOW() - INTERVAL '44 days',
 NULL, NULL, NULL,
 5, 'Quick over-the-phone fix — perfect.',
 NOW() - INTERVAL '46 days', NOW() - INTERVAL '44 days'),

-- ── AES-2026-1105  user5 · OPEN at L1 (recent, P1 AMC) ────────────────
('11000000-0000-0000-0000-000000000006', 'AES-2026-1105',
 'a0000005-0000-0000-0000-000000000005', 'e0000005-0000-0000-0000-000000000005',
 'a5c00001-0000-0000-0000-000000000001',
 'P1', 'AMC', 'NOISE',
 'Main hall VRF is rattling whenever the compressor cycles up. AMC scheduled visit + noise inspection requested.',
 '[]'::jsonb,
 1, 'b0000002-0000-0000-0000-000000000002', NOW() - INTERVAL '4 hours',
 'OPEN',
 NOW() - INTERVAL '4 hours' + INTERVAL '30 minutes',
 NULL,
 NOW() + INTERVAL '20 hours',
 NULL, NULL, NULL,
 NULL, NULL, NULL,
 NULL, NULL,
 NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours');


-- ============================================================
-- 9. TICKET ESCALATION LOG
-- ============================================================
INSERT INTO ticket_escalation_log (id, ticket_id, from_level, to_level, from_user_id, reason, escalation_type, escalated_at) VALUES
  -- AES-2026-1101 (resolved with history)
  ('e1100000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002',
   1, 2, 'b0000001-0000-0000-0000-000000000001',
   'L1 SLA breached — cassette leak still active', 'AUTO',
   NOW() - INTERVAL '21 days 18 hours'),

  -- AES-2026-1103 (live demo: already at L2)
  ('e1100000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000004',
   1, 2, 'b0000001-0000-0000-0000-000000000001',
   'Manual escalation — ICU criticality flagged by CRM', 'MANUAL',
   NOW() - INTERVAL '14 hours');


-- ============================================================
-- 10. TICKET ACTIVITY TIMELINE
-- ============================================================
INSERT INTO ticket_activities (id, ticket_id, user_id, activity_type, description, created_at) VALUES
  -- AES-2026-1100 (resolved, simple flow)
  ('1ac10000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'TICKET_RAISED',  'Ticket raised by Aarav Reddy', NOW() - INTERVAL '30 days 10 hours'),
  ('1ac10000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'ACKNOWLEDGED',  'Ravi (CRM) acknowledged within SLA',           NOW() - INTERVAL '30 days 9 hours 12 min'),
  ('1ac10000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'STATUS_CHANGED', 'Suresh (Service) on-site — diagnosis: stabilizer failure', NOW() - INTERVAL '30 days 8 hours'),
  ('1ac10000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'RESOLVED',       'Stabilizer replaced, unit re-tested',          NOW() - INTERVAL '30 days 7 hours'),
  ('1ac10000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'RATED',          'Customer rated 5★',                            NOW() - INTERVAL '29 days'),

  -- AES-2026-1101 (resolved with escalation)
  ('1ac11000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'TICKET_RAISED',  'Aarav reported water leak from cassette',     NOW() - INTERVAL '22 days'),
  ('1ac11000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 'ACKNOWLEDGED',  'Ravi acknowledged',                           NOW() - INTERVAL '21 days 23 hours'),
  ('1ac11000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 'ESCALATED',     'Auto-escalated to L2 — drain pump flagged',  NOW() - INTERVAL '21 days 18 hours'),
  ('1ac11000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'STATUS_CHANGED','Suresh on-site, drain pump replacement ordered', NOW() - INTERVAL '21 days'),
  ('1ac11000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'RESOLVED',       'Drain pump replaced, no further leakage',     NOW() - INTERVAL '20 days 14 hours'),

  -- AES-2026-1102 (LIVE DEMO — open, awaiting acknowledgement)
  ('1ac12000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', 'TICKET_RAISED',  'Karan raised ticket — workspace cassette warm air', NOW() - INTERVAL '30 minutes'),
  ('1ac12000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003', NULL,                                   'ASSIGNED',       'Auto-assigned to Ravi (L1)',                  NOW() - INTERVAL '30 minutes'),

  -- AES-2026-1103 (LIVE DEMO — already at L2)
  ('1ac13000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004', 'TICKET_RAISED',  'Sneha raised ticket — ICU ductable leak',     NOW() - INTERVAL '24 hours'),
  ('1ac13000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000001', 'ACKNOWLEDGED',  'Ravi acknowledged, flagged for hospital priority', NOW() - INTERVAL '23 hours 40 min'),
  ('1ac13000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000001', 'ESCALATED',     'Manually escalated — ICU criticality',        NOW() - INTERVAL '14 hours'),
  ('1ac13000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'STATUS_CHANGED','Suresh on-site, drain line cleared, monitoring overnight', NOW() - INTERVAL '12 hours'),
  ('1ac13000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'NOTE_ADDED',    'Drain pump shows reduced flow — replacement requested', NOW() - INTERVAL '8 hours'),

  -- AES-2026-1104 (closed warranty)
  ('1ac14000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005', 'TICKET_RAISED',  'Vikram reported remote pairing failure',      NOW() - INTERVAL '46 days'),
  ('1ac14000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000005', 'b0000002-0000-0000-0000-000000000002', 'ACKNOWLEDGED',  'Lakshmi acknowledged',                        NOW() - INTERVAL '45 days 9 hours'),
  ('1ac14000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000005', 'b0000002-0000-0000-0000-000000000002', 'RESOLVED',       'Phone walkthrough — remote re-pair succeeded',NOW() - INTERVAL '45 days 4 hours'),
  ('1ac14000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000005', 'a0000005-0000-0000-0000-000000000005', 'RATED',          'Customer rated 5★',                          NOW() - INTERVAL '44 days'),

  -- AES-2026-1105 (open, recent)
  ('1ac15000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000006', 'a0000005-0000-0000-0000-000000000005', 'TICKET_RAISED',  'Vikram reported VRF rattling',                NOW() - INTERVAL '4 hours'),
  ('1ac15000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000006', NULL,                                   'ASSIGNED',       'Auto-assigned to Lakshmi (L1)',               NOW() - INTERVAL '4 hours');


-- ============================================================
-- 11. PART REQUEST  (one open part order tied to ICU ticket)
-- ============================================================
INSERT INTO part_requests (id, ticket_id, requested_by, part_name, quantity, urgency, notes, status, created_at) VALUES
  ('1f000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000004',
   'c0000001-0000-0000-0000-000000000001',
   'Carrier XPower drain pump — 11kW', 1, 'URGENT',
   'ICU ductable — current pump showing reduced flow.',
   'PENDING',
   NOW() - INTERVAL '8 hours');


-- ============================================================
-- 12. NOTIFICATIONS  (mix of read + unread per role)
-- ============================================================
INSERT INTO notifications (id, user_id, title, body, type, reference_id, reference_type, is_read, sent_sms, created_at) VALUES

  -- ─── Customers ─────────────────────────────────────────────
  -- user1 — happy customer, AMC visit reminder
  ('1ff00001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001',
   'AMC visit scheduled', 'Your visit #3 is on ' || TO_CHAR(CURRENT_DATE + INTERVAL '5 days', 'DD Mon') || ', morning slot.',
   'AMC_REMINDER', 'aab00003-0000-0000-0000-000000000001', 'AMC_VISIT',
   FALSE, TRUE, NOW() - INTERVAL '6 hours'),

  -- user2 — installation request received
  ('1ff00002-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002',
   'Installation request received', 'Request INS-2026-2101 received. Our team will call within 2 hours.',
   'INSTALLATION_UPDATE', 'aac00001-0000-0000-0000-000000000001', 'INSTALL_REQUEST',
   FALSE, TRUE, NOW() - INTERVAL '1 day'),

  -- user3 — recently raised ticket
  ('1ff00003-0000-0000-0000-000000000001', 'a0000003-0000-0000-0000-000000000003',
   'Ticket received', 'Ticket AES-2026-1102 created. We''ll respond within 30 minutes.',
   'TICKET_RAISED', '11000000-0000-0000-0000-000000000003', 'TICKET',
   FALSE, TRUE, NOW() - INTERVAL '30 minutes'),

  -- user4 — escalation already happened
  ('1ff00004-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004',
   'Ticket escalated to senior team', 'AES-2026-1103 escalated to L2. Suresh from Service is now handling it.',
   'TICKET_ESCALATED', '11000000-0000-0000-0000-000000000004', 'TICKET',
   FALSE, TRUE, NOW() - INTERVAL '14 hours'),
  ('1ff00004-0000-0000-0000-000000000002', 'a0000004-0000-0000-0000-000000000004',
   'On-site update', 'Engineer cleared drain line. Replacement part ordered, monitoring overnight.',
   'TICKET_RESOLVED', '11000000-0000-0000-0000-000000000004', 'TICKET',
   TRUE, TRUE, NOW() - INTERVAL '12 hours'),

  -- user5 — multiple
  ('1ff00005-0000-0000-0000-000000000001', 'a0000005-0000-0000-0000-000000000005',
   'AMC visit scheduled', 'First visit on ' || TO_CHAR(CURRENT_DATE + INTERVAL '76 days', 'DD Mon') || ', afternoon slot.',
   'AMC_REMINDER', 'aab00005-0000-0000-0000-000000000002', 'AMC_VISIT',
   TRUE, TRUE, NOW() - INTERVAL '14 days'),
  ('1ff00005-0000-0000-0000-000000000002', 'a0000005-0000-0000-0000-000000000005',
   'Ticket received', 'AES-2026-1105 created. Our AMC engineer will be in touch shortly.',
   'TICKET_RAISED', '11000000-0000-0000-0000-000000000006', 'TICKET',
   FALSE, TRUE, NOW() - INTERVAL '4 hours'),

  -- ─── Staff ─────────────────────────────────────────────────
  -- crm1 (Ravi) — has the live demo ticket waiting
  ('1ff00010-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001',
   'New ticket assigned',  'AES-2026-1102 (P3 PAID, NOT_COOLING) — Karan Patel, iSprout.',
   'TICKET_ASSIGNED', '11000000-0000-0000-0000-000000000003', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '30 minutes'),

  -- crm2 (Lakshmi) — has user5's recent ticket
  ('1ff00011-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002',
   'New ticket assigned',  'AES-2026-1105 (P1 AMC, NOISE) — Vikram Singh, Tabla Restaurant.',
   'TICKET_ASSIGNED', '11000000-0000-0000-0000-000000000006', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '4 hours'),

  -- service1 (Suresh) — has the L2 escalation already in progress
  ('1ff00020-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
   'Escalation: ICU criticality',  'AES-2026-1103 escalated from L1 — hospital ICU, urgent.',
   'TICKET_ESCALATED', '11000000-0000-0000-0000-000000000004', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '14 hours'),

  -- service2 (Deepa) — clean inbox (intentional — demo target after escalation)
  ('1ff00021-0000-0000-0000-000000000001', 'c0000002-0000-0000-0000-000000000002',
   'Welcome, Deepa', 'You currently have no pending escalations.',
   'TICKET_ASSIGNED', NULL, NULL,
   TRUE, FALSE, NOW() - INTERVAL '500 days'),

  -- admin (Anand) — overall summary
  ('1ff00030-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001',
   'Daily KPI digest', '6 active tickets · 1 at L2 · 2 awaiting L1 ack · AMC visit due in 5 days.',
   'TICKET_ASSIGNED', NULL, NULL,
   FALSE, FALSE, NOW() - INTERVAL '2 hours');
