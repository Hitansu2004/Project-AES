-- ============================================================
-- AES Customer Portal · V10 — Phases 3–7 Demo Seed
--
-- Adds:
--   • AES-2026-1112 — ACKNOWLEDGED ticket assigned to Lakshmi, ready
--     for engineer dispatch (drives the C7/C12 demo).
--   • AES-2026-1113 — ASSIGNED ticket with engineer Rajesh already
--     accepted (drives EN_ROUTE → ON_SITE → RESOLVED demo).
--   • INS-2026-2105 — installation lead owned by Lakshmi with an
--     APPROVED quote awaiting customer accept (drives C21/C22 demo).
--   • PartRequest pending CRM approval on AES-2026-1112.
-- All UUIDs use fresh prefixes (1112…/1113…/2105…) so they cannot
-- collide with V4/V5/V8 fixtures.
-- ============================================================

-- ─── 1) AES-2026-1112 — ACKNOWLEDGED, ready for engineer dispatch ──
INSERT INTO service_tickets (
    id, ticket_number, customer_id, property_id, ac_unit_id,
    priority, service_type, problem_category, problem_description,
    photos_json,
    current_level, current_assignee_id, assigned_at,
    status,
    sla_deadline_l1, sla_deadline_l2, sla_deadline_final,
    acknowledged_at,
    branch, locality,
    triage_at, triaged_by,
    created_at, updated_at
) VALUES (
    '11000000-0000-0000-0000-00000000000d', 'AES-2026-1112',
    'a0000005-0000-0000-0000-000000000005',
    'e0000005-0000-0000-0000-000000000005',
    'a5c00001-0000-0000-0000-000000000001',
    'P2', 'WARRANTY', 'NOT_COOLING',
    'Kitchen split AC tripping power every 10 min — under warranty.',
    '[]'::jsonb,
    1, 'b0000002-0000-0000-0000-000000000002', NOW() - INTERVAL '40 minutes',
    'ACKNOWLEDGED',
    NOW() - INTERVAL '45 minutes' + INTERVAL '30 minutes',
    NULL,
    NOW() + INTERVAL '7 hours 15 minutes',
    NOW() - INTERVAL '40 minutes',
    'HYDERABAD', 'BANJARA_HILLS',
    NOW() - INTERVAL '45 minutes', '20000001-0000-0000-0000-000000000001',
    NOW() - INTERVAL '1 hour', NOW() - INTERVAL '40 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 2) AES-2026-1113 — ASSIGNED, engineer Rajesh accepted ────────
INSERT INTO service_tickets (
    id, ticket_number, customer_id, property_id, ac_unit_id,
    priority, service_type, problem_category, problem_description,
    photos_json,
    current_level, current_assignee_id, assigned_at,
    status,
    sla_deadline_l1, sla_deadline_l2, sla_deadline_final,
    acknowledged_at,
    engineer_id, engineer_accepted_at,
    branch, locality,
    triage_at, triaged_by,
    created_at, updated_at
) VALUES (
    '11000000-0000-0000-0000-00000000000e', 'AES-2026-1113',
    'a0000001-0000-0000-0000-000000000001',
    'e0000001-0000-0000-0000-000000000001',
    'a1c00001-0000-0000-0000-000000000001',
    'P1', 'AMC', 'LEAKING',
    'Living room cassette dripping water onto the floor — VIP AMC.',
    '[]'::jsonb,
    1, 'b0000001-0000-0000-0000-000000000001', NOW() - INTERVAL '90 minutes',
    'ASSIGNED',
    NOW() - INTERVAL '95 minutes' + INTERVAL '30 minutes',
    NULL,
    NOW() + INTERVAL '2 hours 30 minutes',
    NOW() - INTERVAL '90 minutes',
    '30000001-0000-0000-0000-000000000001', NOW() - INTERVAL '20 minutes',
    'HYDERABAD', 'JUBILEE_HILLS',
    NOW() - INTERVAL '95 minutes', '20000001-0000-0000-0000-000000000001',
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '20 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 3) INS-2026-2105 — install with APPROVED quote ready to send ─
INSERT INTO installation_requests (
    id, request_number, customer_id, property_id,
    ac_type, brand, model_number, tonnage, energy_rating,
    rooms_json, scheduled_date, scheduled_slot,
    status, estimated_cost, notes,
    branch, locality,
    triage_at, triaged_by, owner_crm_id,
    created_at, updated_at
) VALUES (
    '12000000-0000-0000-0000-000000000005', 'INS-2026-2105',
    'a0000005-0000-0000-0000-000000000005',
    'e0000005-0000-0000-0000-000000000005',
    'SPLIT', 'Daikin', 'FTKM50UV16U', 1.5, 5,
    '[{"label":"Master Bedroom","tonnage":1.5}]'::jsonb,
    NULL, 'MORNING',
    'QUOTE_DRAFT', 78000.00,
    '5★ Daikin split, copper piping 3m. Quote drafted by Lakshmi.',
    'HYDERABAD', 'BANJARA_HILLS',
    NOW() - INTERVAL '2 days', '20000001-0000-0000-0000-000000000001',
    'b0000002-0000-0000-0000-000000000002',
    NOW() - INTERVAL '2 days 1 hour', NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO NOTHING;

-- ─── 4) Quote QUO-2026-0001 on INS-2026-2105 — DRAFT ──────────────
INSERT INTO quotes (
    id, quote_number, install_id, version,
    line_items_json,
    subtotal, tax, discount, total, valid_until,
    status, prepared_by, notes,
    created_at, updated_at
) VALUES (
    'a0a00001-0000-0000-0000-000000000001', 'QUO-2026-0001',
    '12000000-0000-0000-0000-000000000005', 1,
    '[
      {"description":"Daikin 1.5T 5★ Inverter Split","qty":1,"unitPrice":48000,"gstPct":18},
      {"description":"Copper piping 3m + insulation","qty":1,"unitPrice":3500,"gstPct":18},
      {"description":"Installation labour","qty":1,"unitPrice":4000,"gstPct":18},
      {"description":"AMC 1yr add-on","qty":1,"unitPrice":4000,"gstPct":18}
    ]'::jsonb,
    59500.00, 10710.00, 0.00, 70210.00,
    (CURRENT_DATE + INTERVAL '7 days')::date,
    'DRAFT',
    'b0000002-0000-0000-0000-000000000002',
    'Daikin Quote v1 — ready for Service Manager approval.',
    NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO NOTHING;

-- ─── 5) PartRequest on AES-2026-1112 — pending CRM approval ───────
INSERT INTO part_requests (
    id, ticket_id, requested_by, part_name, quantity, urgency,
    unit_cost, total_cost,
    notes, status, created_at, updated_at
) VALUES (
    'a0b00001-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-00000000000d',
    '30000001-0000-0000-0000-000000000001',
    'Compressor relay (Daikin OEM)', 1, 'HIGH',
    3200.00, 3200.00,
    'Original part failed on inspection — needs replacement before warranty restoration.',
    'PENDING_APPROVAL',
    NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 6) Bump ticket sequence past the seeded demo IDs (so new tickets
--       issued at runtime start at AES-YYYY-1200 instead of clashing with
--       1100..1113). Run unconditionally — setval is idempotent.
SELECT setval('ticket_seq', 1199, true);
SELECT setval('installation_req_seq', 2199, true);
SELECT setval('quote_seq', 1, true);

-- ─── 7) Activity rows for new tickets ─────────────────────────────
INSERT INTO ticket_activities (id, ticket_id, user_id, activity_type, description, created_at) VALUES
  ('1ac1c000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000d',
   'a0000005-0000-0000-0000-000000000005', 'TICKET_RAISED',
   'Vikram raised P2 warranty ticket — kitchen AC tripping power', NOW() - INTERVAL '1 hour'),
  ('1ac1c000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-00000000000d',
   '20000001-0000-0000-0000-000000000001', 'STATUS_CHANGED',
   'Triaged by Meera → offered to Lakshmi', NOW() - INTERVAL '45 minutes'),
  ('1ac1c000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-00000000000d',
   'b0000002-0000-0000-0000-000000000002', 'ACKNOWLEDGED',
   'Lakshmi acknowledged the ticket', NOW() - INTERVAL '40 minutes'),

  ('1ac1d000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000e',
   'a0000001-0000-0000-0000-000000000001', 'TICKET_RAISED',
   'Aarav raised P1 AMC ticket — living room cassette leaking', NOW() - INTERVAL '2 hours'),
  ('1ac1d000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-00000000000e',
   '20000001-0000-0000-0000-000000000001', 'STATUS_CHANGED',
   'Triaged by Meera → Ravi accepts ownership', NOW() - INTERVAL '95 minutes'),
  ('1ac1d000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-00000000000e',
   'b0000001-0000-0000-0000-000000000001', 'ACKNOWLEDGED',
   'Ravi acknowledged the ticket', NOW() - INTERVAL '90 minutes'),
  ('1ac1d000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-00000000000e',
   'b0000001-0000-0000-0000-000000000001', 'ASSIGNED',
   'Dispatch offered to engineer Rajesh', NOW() - INTERVAL '30 minutes'),
  ('1ac1d000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-00000000000e',
   '30000001-0000-0000-0000-000000000001', 'STATUS_CHANGED',
   'Engineer Rajesh accepted dispatch (ETA 30 min)', NOW() - INTERVAL '20 minutes')
ON CONFLICT (id) DO NOTHING;
