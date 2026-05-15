-- ============================================================
-- AES Customer Portal — V5 Demo: L3 (Management) Escalation
--
-- Adds one fully-escalated ticket so the admin "eagle view"
-- has live L3 content during the demo. Customer is User 4
-- (Sneha Iyer, Adarsha Hospital), AC unit is the OPD CENTRAL.
--
-- Chain of custody:
--   L0 raised by Sneha (customer)
--   L0→L1   auto-assigned to Ravi (CRM)
--   L1→L2   auto-escalated (L1 SLA breached) to Suresh (Service Mgr)
--   L2→L3   manually escalated by Suresh to Anand (Admin)
--           — reason: hospital OPD downtime, bigger budget approval
--             needed for full coil replacement.
--
-- All inserts are idempotent (ON CONFLICT DO NOTHING) so this file
-- is safe to re-run via Flyway *and* directly via psql.
-- ============================================================

-- 1) Service ticket --------------------------------------------------
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
) VALUES (
    '11000000-0000-0000-0000-000000000007',
    'AES-2026-1106',
    'a0000004-0000-0000-0000-000000000004',           -- Sneha (User 4)
    'e0000004-0000-0000-0000-000000000004',           -- Adarsha Hospital
    'a4c00001-0000-0000-0000-000000000001',           -- OPD Hall — CENTRAL Carrier 4T
    'P3', 'PAID', 'NOT_COOLING',
    'Hospital OPD central AC failure — coil seems blocked, full replacement '
    || 'likely needed. OPD running on backup pedestals. Patient queue '
    || 'building up; needs management approval for fast-track repair.',
    '[]'::jsonb,
    3,                                                -- currentLevel L3
    'd0000001-0000-0000-0000-000000000001',           -- Anand (Admin)
    NOW() - INTERVAL '90 minutes',                    -- assignedAt (entered L3)
    'IN_PROGRESS',
    NOW() - INTERVAL '6 hours' + INTERVAL '30 minutes',  -- L1 deadline (already breached)
    NOW() - INTERVAL '90 minutes',                       -- L2 deadline (already passed)
    NOW() + INTERVAL '42 hours 30 minutes',              -- final deadline (still ticking)
    NOW() - INTERVAL '5 hours 40 minutes',               -- ack'd by Ravi
    NULL, NULL,
    18500.00, NULL, NULL,
    NULL, NULL,
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '90 minutes'
)
ON CONFLICT (id) DO NOTHING;


-- 2) Escalation log (L1→L2 auto, L2→L3 manual) ----------------------
INSERT INTO ticket_escalation_log
  (id, ticket_id, from_level, to_level, from_user_id, reason, escalation_type, escalated_at)
VALUES
  ('e1100000-0000-0000-0000-000000000003',
   '11000000-0000-0000-0000-000000000007',
   1, 2,
   'b0000001-0000-0000-0000-000000000001',           -- Ravi (CRM agent who held it at L1)
   'L1 30-minute SLA breached — customer is a hospital, OPD downtime impacting patients. Auto-escalated to Service Manager.',
   'AUTO',
   NOW() - INTERVAL '5 hours 30 minutes'),

  ('e1100000-0000-0000-0000-000000000004',
   '11000000-0000-0000-0000-000000000007',
   2, 3,
   'c0000001-0000-0000-0000-000000000001',           -- Suresh (service manager)
   'Coil replacement quoted at INR 1.85L — exceeds my approval limit (INR 1L). Escalating to Management for budget sign-off and emergency engineer dispatch from Pune branch.',
   'MANUAL',
   NOW() - INTERVAL '90 minutes')
ON CONFLICT (id) DO NOTHING;


-- 3) Activity timeline ----------------------------------------------
INSERT INTO ticket_activities (id, ticket_id, user_id, activity_type, description, created_at) VALUES
  ('1ac16000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000007',
   'a0000004-0000-0000-0000-000000000004', 'TICKET_RAISED',
   'Sneha raised P3 PAID ticket — OPD central AC not cooling.',
   NOW() - INTERVAL '6 hours'),

  ('1ac16000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000007',
   NULL, 'ASSIGNED',
   'Auto-assigned to Ravi (L1 CRM).',
   NOW() - INTERVAL '6 hours'),

  ('1ac16000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000007',
   'b0000001-0000-0000-0000-000000000001', 'ACKNOWLEDGED',
   'Ravi acknowledged — flagged hospital priority, briefed engineer pool.',
   NOW() - INTERVAL '5 hours 40 minutes'),

  ('1ac16000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000007',
   'b0000001-0000-0000-0000-000000000001', 'ESCALATED',
   'Auto-escalated to L2 (Service Manager) — L1 SLA breached due to engineer travel time.',
   NOW() - INTERVAL '5 hours 30 minutes'),

  ('1ac16000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000007',
   'c0000001-0000-0000-0000-000000000001', 'STATUS_CHANGED',
   'Suresh on-site at hospital — diagnosed clogged coil + leaking refrigerant line on the OPD unit.',
   NOW() - INTERVAL '4 hours'),

  ('1ac16000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000007',
   'c0000001-0000-0000-0000-000000000001', 'NOTE_ADDED',
   'Vendor quote received: INR 1.85L for full coil replacement + recharge. Outside my approval limit.',
   NOW() - INTERVAL '2 hours'),

  ('1ac16000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000007',
   'c0000001-0000-0000-0000-000000000001', 'ESCALATED',
   'Manually escalated to L3 (Management) — needs budget approval + Pune-branch engineer dispatch.',
   NOW() - INTERVAL '90 minutes'),

  ('1ac16000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000007',
   'd0000001-0000-0000-0000-000000000001', 'NOTE_ADDED',
   'Anand approved emergency budget; coordinating Pune engineer arrival by tomorrow morning.',
   NOW() - INTERVAL '60 minutes')
ON CONFLICT (id) DO NOTHING;


-- 4) Part request ---------------------------------------------------
INSERT INTO part_requests (id, ticket_id, requested_by, part_name, quantity, urgency, notes, status, created_at) VALUES
  ('1f000000-0000-0000-0000-000000000002',
   '11000000-0000-0000-0000-000000000007',
   'c0000001-0000-0000-0000-000000000001',
   'Carrier XPower 11kW — replacement coil assembly + R-410A 5kg', 1, 'URGENT',
   'Coil corrosion + refrigerant leak. Pune branch confirmed stock; approval pending from Anand.',
   'PENDING',
   NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;


-- 5) Notifications --------------------------------------------------
INSERT INTO notifications (id, user_id, title, body, type, reference_id, reference_type, is_read, sent_sms, created_at) VALUES
  -- Sneha (customer) — escalation reaches Management
  ('1ff00004-0000-0000-0000-000000000003', 'a0000004-0000-0000-0000-000000000004',
   'Ticket escalated to Management',
   'AES-2026-1106 has been escalated to L3 (Management) — Anand Rao is personally tracking it. Pune-branch engineer arriving tomorrow.',
   'TICKET_ESCALATED', '11000000-0000-0000-0000-000000000007', 'TICKET',
   FALSE, TRUE, NOW() - INTERVAL '85 minutes'),

  -- Suresh — confirms upward escalation
  ('1ff00020-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001',
   'L3 escalation confirmed',
   'AES-2026-1106 escalated to Anand for INR 1.85L coil approval. Pune dispatch in motion.',
   'TICKET_ESCALATED', '11000000-0000-0000-0000-000000000007', 'TICKET',
   TRUE, FALSE, NOW() - INTERVAL '90 minutes'),

  -- Anand — gets the L3 hot potato
  ('1ff00030-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001',
   'L3 escalation: hospital OPD down',
   'AES-2026-1106 (P3 PAID, NOT_COOLING) — Adarsha Hospital OPD. Coil replacement INR 1.85L. From Suresh (Service).',
   'TICKET_ESCALATED', '11000000-0000-0000-0000-000000000007', 'TICKET',
   FALSE, FALSE, NOW() - INTERVAL '90 minutes')
ON CONFLICT (id) DO NOTHING;
