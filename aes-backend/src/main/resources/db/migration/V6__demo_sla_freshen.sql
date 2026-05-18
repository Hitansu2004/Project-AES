-- ============================================================
-- AES Customer Portal · V6 — Demo SLA Freshen
--
-- The V4 seed defines tight SLA windows ("30 min ago + 30 min" =
-- right at NOW(), "14 h ago + 60 min" = 13 h past) so the demo
-- can show "tight bands" on the very first start. From the
-- second start onwards those bands have already breached, and
-- the auto-escalation engine moves the demo tickets to the next
-- level on its first 30 s tick — silently breaking the demo
-- script ("1103 should be at L2, not L3").
--
-- This migration:
--   1. Restores AES-2026-1102 / 1103 / 1105 to the levels and
--      assignees the demo guide expects.
--   2. Pushes their SLA deadlines a comfortable distance into
--      the future so the engine no longer flags them.
--   3. Strips any auto-generated escalation logs / activity rows
--      / notifications that were produced by earlier (broken)
--      runs of the engine. V4-seeded rows are left untouched —
--      they don't match the auto-escalation signature.
--
-- Idempotent — re-running it just re-asserts the same state. Flyway
-- already wraps each migration in its own transaction, so we don't issue
-- BEGIN / COMMIT explicitly (doing so triggers SQL state 25001 warnings).
-- ============================================================

-- ── 1) AES-2026-1102 — back to L1 / OPEN-ACK with comfortable L1 SLA ──
UPDATE service_tickets
   SET current_level       = 1,
       status              = 'ACKNOWLEDGED',
       current_assignee_id = 'b0000001-0000-0000-0000-000000000001',
       sla_deadline_l1     = NOW() + INTERVAL '25 minutes',
       sla_deadline_l2     = NULL,
       sla_deadline_final  = NOW() + INTERVAL '47 hours 30 minutes'
 WHERE ticket_number = 'AES-2026-1102';

-- ── 2) AES-2026-1103 — back to L2 / IN_PROGRESS, L2 deadline in future ──
UPDATE service_tickets
   SET current_level       = 2,
       status              = 'IN_PROGRESS',
       current_assignee_id = 'c0000001-0000-0000-0000-000000000001',
       sla_deadline_l1     = NOW() - INTERVAL '24 hours' + INTERVAL '30 minutes',
       sla_deadline_l2     = NOW() + INTERVAL '60 minutes',
       sla_deadline_final  = NOW() + INTERVAL '34 hours'
 WHERE ticket_number = 'AES-2026-1103';

-- ── 3) AES-2026-1105 — back to L1 / OPEN, L1 deadline in future ──
UPDATE service_tickets
   SET current_level       = 1,
       status              = 'OPEN',
       current_assignee_id = 'b0000002-0000-0000-0000-000000000002',
       sla_deadline_l1     = NOW() + INTERVAL '25 minutes',
       sla_deadline_l2     = NULL,
       sla_deadline_final  = NOW() + INTERVAL '20 hours'
 WHERE ticket_number = 'AES-2026-1105';

-- ── 4) Strip auto-escalation log rows produced by previous runs ──
DELETE FROM ticket_escalation_log
 WHERE escalation_type = 'AUTO'
   AND reason LIKE 'Auto:%'
   AND ticket_id IN (
        SELECT id FROM service_tickets
         WHERE ticket_number IN ('AES-2026-1102','AES-2026-1103','AES-2026-1105')
   );

-- ── 5) Strip auto-generated ESCALATED activity entries ──
DELETE FROM ticket_activities
 WHERE activity_type = 'ESCALATED'
   AND description LIKE 'Auto-escalated%'
   AND ticket_id IN (
        SELECT id FROM service_tickets
         WHERE ticket_number IN ('AES-2026-1102','AES-2026-1103','AES-2026-1105')
   );

-- ── 6) Strip duplicate auto-escalation notifications ──
-- The engine's payload is unique enough to scope safely.
DELETE FROM notifications
 WHERE reference_id IN (
        SELECT id FROM service_tickets
         WHERE ticket_number IN ('AES-2026-1102','AES-2026-1103','AES-2026-1105')
       )
   AND (
        (title LIKE 'Update on ticket AES-2026-110%'
              AND body LIKE '%escalated to our%')
     OR (title = 'New escalated ticket'
              AND body LIKE '%has been escalated to you. Reason: Auto:%')
   );
