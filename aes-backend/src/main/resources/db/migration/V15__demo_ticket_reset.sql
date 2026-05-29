-- ============================================================
-- V15  Demo data reset — 12 realistic service tickets
-- ============================================================
-- Wipes the messy 70+ accumulated demo tickets (and their
-- activities / notes / parts / quotes / payments / offers) and
-- reseeds a curated set that walks every dashboard through a
-- believable journey:
--
--   • happy customers leaving 5-star feedback,
--   • a mixed 3-star "tech was late" review,
--   • a frustrated 1-star + manual customer escalation,
--   • tickets sitting in the CRM pool waiting to be picked,
--   • tickets that are ACKNOWLEDGED / EN_ROUTE / ON_SITE /
--     WAITING_PART / WAITING_CUSTOMER_APPROVAL,
--   • a paid revenue trail (cash, UPI, card),
--   • one carry-forward demo row.
--
-- After this migration the Revenue HQ dashboard, CRM pool, and
-- engineer board all show non-empty, realistic data.
-- ============================================================

-- ── 1) WIPE ───────────────────────────────────────────────────
-- Order matters: clear references before the parent rows.
DELETE FROM ticket_notes;
DELETE FROM ticket_activities;
DELETE FROM ticket_escalation_log;
DELETE FROM assignment_offers;
DELETE FROM part_requests;
DELETE FROM payment_transactions;
DELETE FROM quotes WHERE ticket_id IS NOT NULL;
-- Drop ticket-scoped notifications too so the bell isn't full of
-- references to ghost tickets.  Other notifications stay put.
DELETE FROM notifications WHERE reference_type = 'TICKET';
DELETE FROM amc_upgrade_requests;
DELETE FROM ticket_drafts;
DELETE FROM service_tickets;

-- ── 2) RESEED — 12 curated tickets ───────────────────────────
-- Customer ID legend:
--   a0000001  Aarav Reddy   (residence — Villa #42)
--   a0000003  Karan Patel   (commercial — iSprout Office)
--   a0000004  Sneha Iyer    (healthcare — Adarsha Hospital)
--   a0000005  Vikram Singh  (restaurant — Tabla)
--   d6762698  Hitansu       (residence — villa1)
--
-- Staff IDs:
--   Ravi (CRM, Team 01)   b0000001-0000-0000-0000-000000000001
--   Lakshmi (CRM, T04)    b0000002-0000-0000-0000-000000000002
--   Suresh (SM, Team 02)  c0000001-0000-0000-0000-000000000001
--   Deepa  (SM, Team 03)  c0000002-0000-0000-0000-000000000002
--   Rajesh (Eng, Team 01) 30000001-0000-0000-0000-000000000001
--   Imran  (Eng, Team 02) 30000002-0000-0000-0000-000000000002
--   Sandeep (Eng, Team 03)30000003-0000-0000-0000-000000000003

-- ─── Ticket 1: 5★ AMC happy path (Karan / iSprout office) ───
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at, resolved_at, closed_at,
   customer_rating, customer_feedback,
   payment_status, total_charge, base_charge,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000001', 'AES-2026-1001',
   'a0000003-0000-0000-0000-000000000003',
   'e0000003-0000-0000-0000-000000000003',
   'a3c00001-0000-0000-0000-000000000001',
   'P1', 'AMC', 'NOT_COOLING',
   'Open workspace 1 cassette unit not cooling since morning. Office full of staff — please send someone fast.',
   CURRENT_DATE - 2, 'MORNING', 'CLOSED', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01',
   '30000001-0000-0000-0000-000000000001', 'HYDERABAD',
   NOW() - INTERVAL '2 days 5 hours',
   NOW() - INTERVAL '2 days 4 hours 50 minutes',
   NOW() - INTERVAL '2 days 4 hours 45 minutes',
   NOW() - INTERVAL '2 days 4 hours 10 minutes',
   NOW() - INTERVAL '2 days 3 hours 40 minutes',
   NOW() - INTERVAL '2 days 2 hours 30 minutes',
   NOW() - INTERVAL '2 days 2 hours 25 minutes',
   5, 'Rajesh was on time, explained everything and the unit is running better than before. Brilliant service — exactly why we keep our AMC with AES.',
   'NOT_REQUIRED', NULL, NULL,
   NOW() - INTERVAL '2 days 5 hours 10 minutes',
   NOW() - INTERVAL '2 days 2 hours 25 minutes');

-- ─── Ticket 2: 4★ Warranty — successful repair (Aarav) ──────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at, resolved_at, closed_at,
   customer_rating, customer_feedback,
   payment_status, total_charge, base_charge,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000002', 'AES-2026-1002',
   'a0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'a1c00001-0000-0000-0000-000000000001',
   'P2', 'WARRANTY', 'NOISE',
   'Master bedroom Mitsubishi making a loud rattling sound when fan speed is high. Started about a week ago.',
   CURRENT_DATE - 1, 'AFTERNOON', 'RESOLVED', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01',
   '30000001-0000-0000-0000-000000000001', 'HYDERABAD',
   NOW() - INTERVAL '1 day 7 hours',
   NOW() - INTERVAL '1 day 6 hours 30 minutes',
   NOW() - INTERVAL '1 day 6 hours 15 minutes',
   NOW() - INTERVAL '1 day 4 hours',
   NOW() - INTERVAL '1 day 3 hours 30 minutes',
   NOW() - INTERVAL '1 day 1 hour 30 minutes',
   NULL,
   4, 'Loose fan blade — fixed under warranty in about 90 mins. Took a while to get an appointment but the actual repair was solid.',
   'NOT_REQUIRED', NULL, NULL,
   NOW() - INTERVAL '1 day 8 hours',
   NOW() - INTERVAL '1 day 1 hour 30 minutes');

-- ─── Ticket 3: 5★ Paid — premium revenue txn (Hitansu) ──────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at, resolved_at, closed_at,
   customer_rating, customer_feedback,
   payment_status, payment_method, paid_at,
   total_charge, base_charge, distance_charge, distance_km,
   service_address, service_lat, service_lng,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000003', 'AES-2026-1003',
   'd6762698-0612-41e5-8058-36ff888cd898',
   'ff430fe3-4091-4835-9636-2c6cdc9f6006',
   'a7d1613b-264c-4dc9-b45c-c2b2971faaf9',
   'P3', 'PAID', 'NOT_COOLING',
   'Daikin split in the living room is blowing warm air. Gas refill probably needed.',
   CURRENT_DATE - 1, 'MORNING', 'RESOLVED', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01',
   '30000001-0000-0000-0000-000000000001', 'HYDERABAD',
   NOW() - INTERVAL '1 day 10 hours',
   NOW() - INTERVAL '1 day 9 hours 50 minutes',
   NOW() - INTERVAL '1 day 9 hours 30 minutes',
   NOW() - INTERVAL '1 day 8 hours 30 minutes',
   NOW() - INTERVAL '1 day 8 hours',
   NOW() - INTERVAL '1 day 6 hours 30 minutes',
   NULL,
   5, 'Fast diagnosis, clean refill, no upsell. Worth every rupee — saved me a trip to summer hell.',
   'PAID', 'UPI', NOW() - INTERVAL '1 day 6 hours 25 minutes',
   2250, 1500, 750, 23.9,
   'Tellapur Junction, Plot 14, Tellapur, Hyderabad, Telangana 502032, India',
   17.479, 78.220,
   NOW() - INTERVAL '1 day 11 hours',
   NOW() - INTERVAL '1 day 6 hours 25 minutes');

-- ─── Ticket 4: 3★ Paid — tech late (Vikram / Tabla) ─────────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at, resolved_at, closed_at,
   customer_rating, customer_feedback,
   payment_status, payment_method, paid_at,
   total_charge, base_charge, distance_charge, distance_km,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000004', 'AES-2026-1004',
   'a0000005-0000-0000-0000-000000000005',
   'e0000005-0000-0000-0000-000000000005',
   'a5c00002-0000-0000-0000-000000000002',
   'P3', 'PAID', 'LEAKING',
   'Private dining LG cassette dripping water onto the table — guests complained. Need urgent fix during off-hours.',
   CURRENT_DATE - 3, 'EVENING', 'RESOLVED', 1,
   'b0000002-0000-0000-0000-000000000002', 'Team 04',
   '30000002-0000-0000-0000-000000000002', 'HYDERABAD',
   NOW() - INTERVAL '3 days 6 hours',
   NOW() - INTERVAL '3 days 5 hours 50 minutes',
   NOW() - INTERVAL '3 days 5 hours 30 minutes',
   NOW() - INTERVAL '3 days 3 hours',
   NOW() - INTERVAL '3 days 2 hours 20 minutes',   -- tech showed up late
   NOW() - INTERVAL '3 days 1 hour 10 minutes',
   NULL,
   3, 'Leak is fixed but the technician was about 40 minutes late and didn''t call ahead. Outcome was good, communication was not.',
   'PAID', 'CARD', NOW() - INTERVAL '3 days 1 hour 5 minutes',
   3500, 1500, 750, 18.6,
   NOW() - INTERVAL '3 days 7 hours',
   NOW() - INTERVAL '3 days 1 hour 5 minutes');

-- ─── Ticket 5: IN_PROGRESS — engineer on-site right now ─────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at,
   payment_status, total_charge, base_charge, distance_charge, distance_km,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000005', 'AES-2026-1005',
   'a0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'a1c00002-0000-0000-0000-000000000002',
   'P3', 'PAID', 'NO_AIRFLOW',
   'Living room Daikin cassette — no airflow even at max speed. Filter cleaned 2 weeks ago.',
   CURRENT_DATE, 'AFTERNOON', 'IN_PROGRESS', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01',
   '30000001-0000-0000-0000-000000000001', 'HYDERABAD',
   NOW() - INTERVAL '3 hours',
   NOW() - INTERVAL '2 hours 50 minutes',
   NOW() - INTERVAL '2 hours 40 minutes',
   NOW() - INTERVAL '90 minutes',
   NOW() - INTERVAL '60 minutes',
   'PAID', 2500, 1500, 250, 12.4,
   NOW() - INTERVAL '4 hours',
   NOW() - INTERVAL '60 minutes');

-- Stamp the upfront payment timestamp so Revenue HQ counts it for today.
UPDATE service_tickets
   SET paid_at = NOW() - INTERVAL '3 hours 30 minutes', payment_method = 'UPI'
 WHERE ticket_number = 'AES-2026-1005';

-- ─── Ticket 6: EN_ROUTE — engineer driving over (Sneha) ─────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at,
   payment_status,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000006', 'AES-2026-1006',
   'a0000004-0000-0000-0000-000000000004',
   'e0000004-0000-0000-0000-000000000004',
   'a4c00003-0000-0000-0000-000000000003',
   'P2', 'WARRANTY', 'NOT_TURNING_ON',
   'Reception cassette won''t power on. Display blank, breaker is fine. Hospital reception — needs cooling for waiting patients.',
   CURRENT_DATE, 'AFTERNOON', 'EN_ROUTE', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 02',
   '30000002-0000-0000-0000-000000000002', 'HYDERABAD',
   NOW() - INTERVAL '2 hours',
   NOW() - INTERVAL '1 hour 50 minutes',
   NOW() - INTERVAL '1 hour 40 minutes',
   NOW() - INTERVAL '25 minutes',
   'NOT_REQUIRED',
   NOW() - INTERVAL '3 hours',
   NOW() - INTERVAL '25 minutes');

-- ─── Ticket 7: ACKNOWLEDGED — CRM just picked it (Aarav) ────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, branch,
   acknowledged_at, assigned_at,
   payment_status,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000007', 'AES-2026-1007',
   'a0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'a1c00003-0000-0000-0000-000000000003',
   'P1', 'AMC', 'NOT_COOLING',
   'Guest room LG not cooling. We have weekend guests — please prioritise. Active AMC.',
   CURRENT_DATE, 'MORNING', 'ACKNOWLEDGED', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01', 'HYDERABAD',
   NOW() - INTERVAL '30 minutes',
   NOW() - INTERVAL '25 minutes',
   'NOT_REQUIRED',
   NOW() - INTERVAL '50 minutes',
   NOW() - INTERVAL '25 minutes');

-- ─── Ticket 8: WAITING_PART — Karan office ────────────────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at,
   payment_status, total_charge, base_charge, distance_charge, distance_km,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000008', 'AES-2026-1008',
   'a0000003-0000-0000-0000-000000000003',
   'e0000003-0000-0000-0000-000000000003',
   'a3c00003-0000-0000-0000-000000000003',
   'P3', 'PAID', 'NOT_TURNING_ON',
   'Conference room Toshiba split intermittently shuts off mid-meeting. Started yesterday.',
   CURRENT_DATE - 1, 'MORNING', 'WAITING_PART', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01',
   '30000001-0000-0000-0000-000000000001', 'HYDERABAD',
   NOW() - INTERVAL '1 day 4 hours',
   NOW() - INTERVAL '1 day 3 hours 50 minutes',
   NOW() - INTERVAL '1 day 3 hours 30 minutes',
   NOW() - INTERVAL '1 day 2 hours 15 minutes',
   NOW() - INTERVAL '1 day 1 hour 50 minutes',
   'NOT_REQUIRED', 1500, 750, 250, 11.2,
   NOW() - INTERVAL '1 day 5 hours',
   NOW() - INTERVAL '1 day');

-- ─── Ticket 9: WAITING_CUSTOMER_APPROVAL — quote sent ────────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, branch,
   acknowledged_at, assigned_at,
   estimated_charge, payment_status,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000009', 'AES-2026-1009',
   'a0000005-0000-0000-0000-000000000005',
   'e0000005-0000-0000-0000-000000000005',
   'a5c00001-0000-0000-0000-000000000001',
   'P2', 'WARRANTY', 'NOT_COOLING',
   'Main hall VRF outdoor unit started tripping. Estimated overhaul needed — quote prepared.',
   CURRENT_DATE, 'AFTERNOON', 'WAITING_CUSTOMER_APPROVAL', 1,
   'b0000002-0000-0000-0000-000000000002', 'Team 04', 'HYDERABAD',
   NOW() - INTERVAL '6 hours',
   NOW() - INTERVAL '5 hours 50 minutes',
   12500.00, 'NOT_REQUIRED',
   NOW() - INTERVAL '8 hours',
   NOW() - INTERVAL '2 hours');

-- ─── Ticket 10: NEW — sitting in the pool (Hitansu villa1) ─
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level, branch,
   payment_status, total_charge, base_charge, distance_charge, distance_km,
   service_address, service_lat, service_lng,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000010', 'AES-2026-1010',
   'd6762698-0612-41e5-8058-36ff888cd898',
   'ff430fe3-4091-4835-9636-2c6cdc9f6006',
   'dba627a6-b631-4cb6-801b-f74110b4eb39',
   'P3', 'PAID', 'SMELL_BURNING',
   'Kids room Voltas cassette has a faint burning smell when started. Turned it off immediately. Need it checked before bedtime.',
   CURRENT_DATE + 1, 'MORNING', 'NEW', 1, 'HYDERABAD',
   'PAID', 2250, 1500, 750, 23.9,
   'Tellapur Junction, Plot 14, Tellapur, Hyderabad, Telangana 502032, India',
   17.479, 78.220,
   NOW() - INTERVAL '12 minutes',
   NOW() - INTERVAL '12 minutes');

UPDATE service_tickets
   SET paid_at = NOW() - INTERVAL '10 minutes', payment_method = 'UPI'
 WHERE ticket_number = 'AES-2026-1010';

-- ─── Ticket 11: NEW — older pool entry (Sneha hospital) ─────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level, branch,
   payment_status,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000011', 'AES-2026-1011',
   'a0000004-0000-0000-0000-000000000004',
   'e0000004-0000-0000-0000-000000000004',
   'a4c00002-0000-0000-0000-000000000002',
   'P1', 'AMC', 'NOT_COOLING',
   'ICU Carrier central AC ductable — current pump showing reduced flow, room temperature creeping up. Critical for patients.',
   CURRENT_DATE, 'EARLY', 'NEW', 1, 'HYDERABAD',
   'NOT_REQUIRED',
   NOW() - INTERVAL '38 minutes',
   NOW() - INTERVAL '38 minutes');

-- ─── Ticket 12: ESCALATED_BY_CUSTOMER — angry customer ──────
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at, on_site_at,
   escalation_reason,
   payment_status, total_charge, base_charge, distance_charge, distance_km,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000012', 'AES-2026-1012',
   'a0000005-0000-0000-0000-000000000005',
   'e0000005-0000-0000-0000-000000000005',
   'a5c00001-0000-0000-0000-000000000001',
   'P1', 'AMC', 'NOT_COOLING',
   'Same VRF problem AGAIN — third call this month. Last "fix" lasted 6 days. Restaurant peak hour starting in 2 hours.',
   CURRENT_DATE, 'EVENING', 'ESCALATED_BY_CUSTOMER', 2,
   'c0000001-0000-0000-0000-000000000001', 'Team 02',
   '30000003-0000-0000-0000-000000000003', 'HYDERABAD',
   NOW() - INTERVAL '5 hours',
   NOW() - INTERVAL '4 hours 30 minutes',
   NOW() - INTERVAL '4 hours',
   NOW() - INTERVAL '2 hours',
   'CUSTOMER_DISSATISFIED',
   'NOT_REQUIRED', NULL, NULL, NULL, 18.6,
   NOW() - INTERVAL '6 hours',
   NOW() - INTERVAL '30 minutes');

-- ─── Ticket 13: Carry-forward demo row (Priya — no AC unit) ─
-- Skip this row; Priya has no AC unit seeded.

-- ─── Ticket 13: Closed-then-paid old win (Aarav, last week) ─
INSERT INTO service_tickets
  (id, ticket_number, customer_id, property_id, ac_unit_id,
   priority, service_type, problem_category, problem_description,
   scheduled_date, scheduled_slot, status, current_level,
   current_assignee_id, assigned_team_name, engineer_id, branch,
   acknowledged_at, assigned_at, engineer_accepted_at,
   en_route_at, on_site_at, resolved_at, closed_at,
   customer_rating, customer_feedback,
   payment_status, payment_method, paid_at,
   total_charge, base_charge, distance_charge, distance_km,
   created_at, updated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000013', 'AES-2026-0998',
   'a0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'a1c00004-0000-0000-0000-000000000004',
   'P3', 'PAID', 'NOISE',
   'Study room Hitachi humming louder than usual. Annual service overdue.',
   CURRENT_DATE - 6, 'AFTERNOON', 'CLOSED', 1,
   'b0000001-0000-0000-0000-000000000001', 'Team 01',
   '30000001-0000-0000-0000-000000000001', 'HYDERABAD',
   NOW() - INTERVAL '6 days 5 hours',
   NOW() - INTERVAL '6 days 4 hours 50 minutes',
   NOW() - INTERVAL '6 days 4 hours 40 minutes',
   NOW() - INTERVAL '6 days 3 hours',
   NOW() - INTERVAL '6 days 2 hours 30 minutes',
   NOW() - INTERVAL '6 days 1 hour',
   NOW() - INTERVAL '6 days 55 minutes',
   5, 'Quick service overhaul, runs whisper-quiet now. Will book annual maintenance next month.',
   'PAID', 'CASH', NOW() - INTERVAL '6 days 55 minutes',
   1800, 750, 250, 13.5,
   NOW() - INTERVAL '6 days 6 hours',
   NOW() - INTERVAL '6 days 55 minutes');

-- ── 3) Activity timeline for the most-visited tickets ───────
-- (Light timeline — enough to make detail pages feel lived-in.)

INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, created_at) VALUES
  -- 1001 happy AMC
  ('e0000010-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001',
   'CRM_PICKED', 'Picked up from CRM pool by Ravi Kumar',          NOW() - INTERVAL '2 days 5 hours'),
  ('e0000010-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001',
   'ENGINEER_ASSIGNED', 'Assigned Rajesh Verma · Team 01',          NOW() - INTERVAL '2 days 4 hours 50 minutes'),
  ('e0000010-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001',
   'ENGINEER_ACCEPTED', 'Rajesh accepted the job',                  NOW() - INTERVAL '2 days 4 hours 45 minutes'),
  ('e0000010-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001',
   'EN_ROUTE', 'Driving to iSprout Office — ETA 25 min',            NOW() - INTERVAL '2 days 4 hours 10 minutes'),
  ('e0000010-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001',
   'ON_SITE', 'Arrived on site',                                    NOW() - INTERVAL '2 days 3 hours 40 minutes'),
  ('e0000010-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001',
   'RESOLVED', 'Refrigerant top-up + filter clean. Cooling restored.', NOW() - INTERVAL '2 days 2 hours 30 minutes'),
  -- 1003 happy paid
  ('e0000010-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001',
   'CRM_PICKED', 'Picked up from CRM pool by Ravi Kumar',          NOW() - INTERVAL '1 day 10 hours'),
  ('e0000010-0000-0000-0000-000000000003', '30000001-0000-0000-0000-000000000001',
   'ON_SITE', 'Arrived at Tellapur Junction',                       NOW() - INTERVAL '1 day 8 hours'),
  ('e0000010-0000-0000-0000-000000000003', '30000001-0000-0000-0000-000000000001',
   'RESOLVED', 'R-410A 1.2 kg refill. Cooling = 12 °C delta. Tested 15 min.', NOW() - INTERVAL '1 day 6 hours 30 minutes'),
  ('e0000010-0000-0000-0000-000000000003', 'd6762698-0612-41e5-8058-36ff888cd898',
   'PAYMENT_RECEIVED', 'UPI payment ₹2,250 received',               NOW() - INTERVAL '1 day 6 hours 25 minutes'),
  -- 1005 in-progress
  ('e0000010-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000001',
   'CRM_PICKED', 'Picked from pool — Ravi Kumar',                   NOW() - INTERVAL '3 hours'),
  ('e0000010-0000-0000-0000-000000000005', '30000001-0000-0000-0000-000000000001',
   'ON_SITE', 'On site at Villa #42',                               NOW() - INTERVAL '60 minutes'),
  ('e0000010-0000-0000-0000-000000000005', '30000001-0000-0000-0000-000000000001',
   'IN_PROGRESS', 'Inspecting evaporator coil and blower motor',    NOW() - INTERVAL '40 minutes'),
  -- 1008 waiting on part
  ('e0000010-0000-0000-0000-000000000008', '30000001-0000-0000-0000-000000000001',
   'PART_REQUESTED', 'Compressor relay needed — raised PR-1001',    NOW() - INTERVAL '1 day 1 hour 45 minutes'),
  -- 1012 escalation
  ('e0000010-0000-0000-0000-000000000012', 'a0000005-0000-0000-0000-000000000005',
   'CUSTOMER_ESCALATED', 'Customer pressed Escalate — third visit this month', NOW() - INTERVAL '30 minutes'),
  ('e0000010-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000001',
   'ESCALATION_RECEIVED', 'Service Manager Suresh accepted Level 2 ownership', NOW() - INTERVAL '25 minutes');

-- ── 4) Internal CRM / engineer notes ────────────────────────
INSERT INTO ticket_notes (ticket_id, author_id, note_type, body, created_at) VALUES
  ('e0000010-0000-0000-0000-000000000007', 'b0000001-0000-0000-0000-000000000001', 'INTERNAL',
   'AMC customer + has weekend guests. Bumping to Rajesh — fastest available P1 hand.', NOW() - INTERVAL '20 minutes'),
  ('e0000010-0000-0000-0000-000000000008', '30000001-0000-0000-0000-000000000001', 'INTERNAL',
   'Compressor relay failed on inspection. Stock confirmed in Hyderabad warehouse, ETA tomorrow AM.', NOW() - INTERVAL '1 day 1 hour 30 minutes'),
  ('e0000010-0000-0000-0000-000000000009', 'b0000002-0000-0000-0000-000000000002', 'INTERNAL',
   'Sent quote ₹12,500 via WhatsApp. Customer asked till 4 PM today to decide.', NOW() - INTERVAL '2 hours'),
  ('e0000010-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000001', 'INTERNAL',
   'Pulling outdoor unit fan + capacitor history. Likely full PCB replacement. Coordinating with Anand for goodwill discount.', NOW() - INTERVAL '20 minutes');

-- ── 5) Escalation log row ────────────────────────────────────
INSERT INTO ticket_escalation_log
  (ticket_id, from_level, to_level, from_user_id, reason, escalation_type, escalated_at)
VALUES
  ('e0000010-0000-0000-0000-000000000012', 1, 2,
   'a0000005-0000-0000-0000-000000000005',
   'Customer escalation — third repeat visit in 30 days for same problem.',
   'CUSTOMER',
   NOW() - INTERVAL '30 minutes');

-- ── 6) Open part request for Ticket 8 (in CRM approval inbox) ─
INSERT INTO part_requests
  (id, ticket_id, requested_by, part_name, quantity, urgency, notes,
   status, unit_cost, total_cost, created_at, updated_at)
VALUES
  ('e0000020-0000-0000-0000-000000000001',
   'e0000010-0000-0000-0000-000000000008',
   '30000001-0000-0000-0000-000000000001',
   'Compressor relay (Toshiba OEM RAS-13)', 1, 'HIGH',
   'Original relay failed on inspection — needs replacement before warranty restoration. Demo stock confirmed.',
   'PENDING_APPROVAL', 3200.00, 3200.00,
   NOW() - INTERVAL '1 day 1 hour 45 minutes',
   NOW() - INTERVAL '1 day 1 hour 45 minutes');

-- ── 7) Quote for Ticket 9 (sent, awaiting customer) ─────────
INSERT INTO quotes
  (id, quote_number, ticket_id, version, line_items_json,
   subtotal, tax, discount, total, valid_until, status,
   prepared_by, sent_at, created_at, updated_at)
VALUES
  ('e0000030-0000-0000-0000-000000000001',
   'QUO-2026-1009', 'e0000010-0000-0000-0000-000000000009', 1,
   '[{"label":"VRF outdoor unit overhaul (labour)","qty":1,"rate":7500},{"label":"R-410A refrigerant — 5kg","qty":1,"rate":3500},{"label":"Capacitor + sensor kit","qty":1,"rate":1500}]'::jsonb,
   12500.00, 0.00, 0.00, 12500.00,
   CURRENT_DATE + 5, 'SENT',
   'b0000002-0000-0000-0000-000000000002',
   NOW() - INTERVAL '2 hours',
   NOW() - INTERVAL '3 hours',
   NOW() - INTERVAL '2 hours');

-- ── 8) Successful payment_transactions for revenue feed ─────
INSERT INTO payment_transactions
  (id, customer_id, ticket_id, amount, currency, status, method,
   gateway, gateway_order_id, gateway_payment_id, created_at, updated_at)
VALUES
  ('e0000040-0000-0000-0000-000000000001',
   'd6762698-0612-41e5-8058-36ff888cd898',
   'e0000010-0000-0000-0000-000000000003',
   2250, 'INR', 'PAID', 'UPI',
   'MOCK', 'order_mock_1003', 'pay_mock_1003',
   NOW() - INTERVAL '1 day 6 hours 30 minutes',
   NOW() - INTERVAL '1 day 6 hours 25 minutes'),
  ('e0000040-0000-0000-0000-000000000002',
   'a0000005-0000-0000-0000-000000000005',
   'e0000010-0000-0000-0000-000000000004',
   3500, 'INR', 'PAID', 'CARD',
   'MOCK', 'order_mock_1004', 'pay_mock_1004',
   NOW() - INTERVAL '3 days 1 hour 10 minutes',
   NOW() - INTERVAL '3 days 1 hour 5 minutes'),
  ('e0000040-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000001',
   'e0000010-0000-0000-0000-000000000013',
   1800, 'INR', 'PAID', 'CASH',
   'MOCK', 'order_mock_0998', 'pay_mock_0998',
   NOW() - INTERVAL '6 days 1 hour',
   NOW() - INTERVAL '6 days 55 minutes'),
  -- Today's upfront payments for the in-progress + new tickets
  ('e0000040-0000-0000-0000-000000000005',
   'a0000001-0000-0000-0000-000000000001',
   'e0000010-0000-0000-0000-000000000005',
   2500, 'INR', 'PAID', 'UPI',
   'MOCK', 'order_mock_1005', 'pay_mock_1005',
   NOW() - INTERVAL '3 hours 35 minutes',
   NOW() - INTERVAL '3 hours 30 minutes'),
  ('e0000040-0000-0000-0000-000000000010',
   'd6762698-0612-41e5-8058-36ff888cd898',
   'e0000010-0000-0000-0000-000000000010',
   2250, 'INR', 'PAID', 'UPI',
   'MOCK', 'order_mock_1010', 'pay_mock_1010',
   NOW() - INTERVAL '15 minutes',
   NOW() - INTERVAL '10 minutes');
