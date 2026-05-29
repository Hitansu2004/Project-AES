-- ============================================================
-- V13  Day-capacity + carry-forward (BookMyShow-style booking)
-- ============================================================
-- The CRM team has a hard daily ceiling of 30 service tickets
-- (15 teams × 2 jobs/day).  Anything that does not get closed
-- by EOD is automatically rolled to the next morning's EARLY
-- slot — those carry-overs eat into the next day's capacity so
-- customers booking the next day see only the remaining slots.
--
-- This migration:
--   • Adds a `carried_forward` flag + `original_scheduled_date`
--     so the dashboard can highlight rolled-over work, and so
--     reporting can tell same-day vs late closures apart.
--   • Adds an index on (scheduled_date, status) for the
--     capacity-counting query — that query runs on every page
--     load of the wizard, so it has to be cheap.
-- ============================================================

ALTER TABLE service_tickets
    ADD COLUMN IF NOT EXISTS carried_forward          BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS original_scheduled_date  DATE;

-- The capacity query: COUNT(*) WHERE scheduled_date = X AND status NOT IN (...).
-- This composite index supports it in one disk seek.
CREATE INDEX IF NOT EXISTS idx_service_tickets_scheduled_date_status
    ON service_tickets (scheduled_date, status);

-- Engineer / CRM dashboards float carry-overs to the top; this index
-- supports "ORDER BY carried_forward DESC, priority, scheduled_date".
CREATE INDEX IF NOT EXISTS idx_service_tickets_carryover
    ON service_tickets (carried_forward, priority, scheduled_date)
    WHERE status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED');

COMMENT ON COLUMN service_tickets.carried_forward IS
    'TRUE when this ticket was rolled forward from a previous day by the nightly carry-forward job. Flips back to FALSE only on resolution.';
COMMENT ON COLUMN service_tickets.original_scheduled_date IS
    'The scheduled_date the customer originally booked. Stays untouched when the ticket gets rolled forward — useful for SLA reporting.';
