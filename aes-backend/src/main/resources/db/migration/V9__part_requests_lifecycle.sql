-- ============================================================
-- V9 — Part Requests lifecycle (Phase 5, PLAN.md §7.5, FLOW.md C13)
--
-- Wires the dormant `part_requests` table to a proper lifecycle
-- (PENDING_APPROVAL → APPROVED / REJECTED → ORDERED → DELIVERED → INSTALLED)
-- with cost-band routing (CRM ≤ ₹5k, SM ≤ ₹50k, Admin > ₹50k).
-- ============================================================

ALTER TABLE part_requests
    ADD COLUMN IF NOT EXISTS unit_cost      NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS total_cost     NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
    ADD COLUMN IF NOT EXISTS ordered_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ordered_by     UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS expected_delivery DATE,
    ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS installed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill — existing demo rows seeded as PENDING become PENDING_APPROVAL.
UPDATE part_requests
   SET status = 'PENDING_APPROVAL'
 WHERE status = 'PENDING';

-- Widen status column so the new ORDERED / DELIVERED / INSTALLED states fit.
ALTER TABLE part_requests
    ALTER COLUMN status TYPE VARCHAR(24);

ALTER TABLE part_requests
    ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';

CREATE INDEX IF NOT EXISTS idx_part_requests_status
    ON part_requests(status);

CREATE INDEX IF NOT EXISTS idx_part_requests_ticket
    ON part_requests(ticket_id);
