-- ============================================================
-- AES Customer Portal · V8 — Phase 2 Demo Seed
--
-- Adds the rows needed to demo the new Ops-Manager triage workflow
-- on a fresh boot:
--   • 1 brand-new untriaged P1 ticket (AES-2026-1109) → lands in
--     Meera's triage inbox.
--   • 1 ticket already OFFERED_CRM to Lakshmi (AES-2026-1110) → lands
--     in Lakshmi's "Pending offers" card.
--   • 1 P2 ticket ESCALATED_BY_CUSTOMER (AES-2026-1111) → red-flag
--     card in Meera's inbox.
--   • Installation INS-2026-2101 from V4 is already untriaged
--     (owner_crm_id NULL after V7) — no change needed; it shows up.
--
-- IMPORTANT: AES-2026-1106 already exists from V5 (the L3 escalation
-- demo) so we MUST use fresh ticket numbers + UUIDs here, otherwise
-- ON CONFLICT silently swallows the inserts and the demo breaks.
--
-- Idempotent via ON CONFLICT DO NOTHING.
-- ============================================================

-- ─── 1) AES-2026-1109 — fresh P1 AMC ticket from Aarav, status=NEW ──
INSERT INTO service_tickets (
    id, ticket_number, customer_id, property_id, ac_unit_id,
    priority, service_type, problem_category, problem_description,
    photos_json,
    current_level, current_assignee_id, assigned_at,
    status,
    sla_deadline_l1, sla_deadline_l2, sla_deadline_final,
    branch, locality,
    created_at, updated_at
) VALUES (
    '11000000-0000-0000-0000-00000000000a', 'AES-2026-1109',
    'a0000001-0000-0000-0000-000000000001',
    'e0000001-0000-0000-0000-000000000001',
    'a1c00003-0000-0000-0000-000000000003',
    'P1', 'AMC', 'NOT_COOLING',
    'Guest room AC stopped cooling overnight. AMC active — needs a same-day visit.',
    '[]'::jsonb,
    1, NULL, NULL,
    'NEW',
    NOW() + INTERVAL '30 minutes',
    NULL,
    NOW() + INTERVAL '4 hours',
    'HYDERABAD', 'JUBILEE_HILLS',
    NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 2) AES-2026-1110 — ticket already OFFERED_CRM to Lakshmi ──────
-- This is the "Sneha's reception cassette" scenario from FLOW.md C10.
INSERT INTO service_tickets (
    id, ticket_number, customer_id, property_id, ac_unit_id,
    priority, service_type, problem_category, problem_description,
    photos_json,
    current_level, current_assignee_id, assigned_at,
    status,
    sla_deadline_l1, sla_deadline_l2, sla_deadline_final,
    branch, locality,
    triage_at, triaged_by,
    created_at, updated_at
) VALUES (
    '11000000-0000-0000-0000-00000000000b', 'AES-2026-1110',
    'a0000004-0000-0000-0000-000000000004',
    'e0000004-0000-0000-0000-000000000004',
    'a4c00003-0000-0000-0000-000000000003',
    'P3', 'PAID', 'NOISE',
    'Reception cassette making loud humming noise during VIP visits. Needs urgent inspection.',
    '[]'::jsonb,
    1, 'b0000002-0000-0000-0000-000000000002', NOW() - INTERVAL '3 minutes',
    'OFFERED_CRM',
    NOW() + INTERVAL '27 minutes',
    NULL,
    NOW() + INTERVAL '23 hours 57 minutes',
    'HYDERABAD', 'MADHAPUR',
    NOW() - INTERVAL '4 minutes', '20000001-0000-0000-0000-000000000001',
    NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '3 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 3) AES-2026-1111 — customer-escalated ticket (T1) ─────────────
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
    escalation_reason,
    created_at, updated_at
) VALUES (
    '11000000-0000-0000-0000-00000000000c', 'AES-2026-1111',
    'a0000003-0000-0000-0000-000000000003',
    'e0000003-0000-0000-0000-000000000003',
    'a3c00003-0000-0000-0000-000000000003',
    'P2', 'WARRANTY', 'NOT_COOLING',
    'Conference room AC was supposed to be fixed yesterday — still not cooling. Important board meeting at 4 PM.',
    '[]'::jsonb,
    1, NULL, NULL,
    'ESCALATED_BY_CUSTOMER',
    NOW() - INTERVAL '5 hours' + INTERVAL '30 minutes',
    NULL,
    NOW() + INTERVAL '3 hours',
    NOW() - INTERVAL '4 hours 30 minutes',
    'HYDERABAD', 'MADHAPUR',
    NOW() - INTERVAL '5 hours', '20000001-0000-0000-0000-000000000001',
    'SLOW_RESPONSE',
    NOW() - INTERVAL '5 hours', NOW() - INTERVAL '15 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 4) AssignmentOffer on AES-2026-1110 → Lakshmi ─────────────────
-- 15-minute window, 12 min still remaining at boot.
INSERT INTO assignment_offers (
    id, ticket_id, install_id, offered_to, offered_by,
    offer_type, mode, note, status, expires_at, created_at
) VALUES (
    '90000001-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-00000000000b',
    NULL,
    'b0000002-0000-0000-0000-000000000002',
    '20000001-0000-0000-0000-000000000001',
    'CRM_OWNER', 'DIRECT',
    'VIP customer — Sneha runs the hospital reception. Please accept and call in 5 min.',
    'OFFERED',
    NOW() + INTERVAL '12 minutes',
    NOW() - INTERVAL '3 minutes'
) ON CONFLICT (id) DO NOTHING;

-- ─── 5) Activity rows for the new demo tickets ─────────────────────
INSERT INTO ticket_activities (id, ticket_id, user_id, activity_type, description, created_at) VALUES
  ('1ac19000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000a',
   'a0000001-0000-0000-0000-000000000001', 'TICKET_RAISED',
   'Aarav raised P1 AMC ticket — guest room AC not cooling',
   NOW() - INTERVAL '5 minutes'),

  ('1ac1a000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000b',
   'a0000004-0000-0000-0000-000000000004', 'TICKET_RAISED',
   'Sneha raised P3 ticket — reception cassette noise',
   NOW() - INTERVAL '4 minutes'),
  ('1ac1a000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-00000000000b',
   '20000001-0000-0000-0000-000000000001', 'STATUS_CHANGED',
   'Triaged by Meera (Ops) → offered to Lakshmi (CRM)',
   NOW() - INTERVAL '3 minutes'),

  ('1ac1b000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000c',
   'a0000003-0000-0000-0000-000000000003', 'TICKET_RAISED',
   'Karan raised P2 ticket — conference room AC',
   NOW() - INTERVAL '5 hours'),
  ('1ac1b000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-00000000000c',
   'b0000001-0000-0000-0000-000000000001', 'ACKNOWLEDGED',
   'Ravi acknowledged within SLA',
   NOW() - INTERVAL '4 hours 30 minutes'),
  ('1ac1b000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-00000000000c',
   'a0000003-0000-0000-0000-000000000003', 'ESCALATED',
   'Customer escalated — reason: Slow response. Important board meeting at 4 PM.',
   NOW() - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

-- ─── 6) Notifications to Meera so her bell isn't empty at boot ─────
INSERT INTO notifications (id, user_id, title, body, type, reference_id,
                            reference_type, is_read, sent_sms, created_at)
VALUES
  ('1ff00060-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001',
   'New P1 ticket — needs triage',
   'AES-2026-1109 from Aarav Reddy (Jubilee Hills). AMC. Guest room AC not cooling.',
   'TICKET_RAISED', '11000000-0000-0000-0000-00000000000a', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '5 minutes'),

  ('1ff00060-0000-0000-0000-000000000002', '20000001-0000-0000-0000-000000000001',
   'Customer escalated — AES-2026-1111',
   'Karan Patel escalated (Slow response). Board meeting at 4 PM — please review.',
   'TICKET_ESCALATED', '11000000-0000-0000-0000-00000000000c', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '15 minutes'),

  -- Lakshmi gets her offer card
  ('1ff00061-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002',
   'New assignment offered',
   'AES-2026-1110 — Sneha Iyer. VIP customer. Respond within 15 min.',
   'TICKET_ASSIGNED', '11000000-0000-0000-0000-00000000000b', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '3 minutes')
ON CONFLICT (id) DO NOTHING;
