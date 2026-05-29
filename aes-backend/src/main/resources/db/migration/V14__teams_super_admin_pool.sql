-- ============================================================
-- V14  Teams · Super Admin · CRM Ticket Pool
-- ============================================================
-- Operational re-org per the latest product brief:
--
--   • CRM dispatch model flips from "offer / accept" to "FIFO
--     pool / one-click pick".  Each CRM agent can hold up to 30
--     tickets/day.  After picking, the agent assigns the ticket
--     to one of 15 named teams; the team lead (or the CRM agent
--     directly) then assigns the work to a Service Engineer.
--
--   • New SUPER_ADMIN role for the company owner — sees the live
--     revenue dashboard + everything any other role can see.
--
--   • New columns:
--       users.team_name           "Team 01" … "Team 15"
--       users.is_team_lead        TRUE for the one lead per team
--       service_tickets.assigned_team_name
-- ============================================================

-- ── 1) New user columns ──────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS team_name    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_team_lead BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_team
    ON users(team_name) WHERE team_name IS NOT NULL;

-- ── 2) Ticket team-assignment column ─────────────────────────
ALTER TABLE service_tickets
    ADD COLUMN IF NOT EXISTS assigned_team_name VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_service_tickets_team
    ON service_tickets(assigned_team_name) WHERE assigned_team_name IS NOT NULL;

-- ── 3) SUPER_ADMIN seed ──────────────────────────────────────
-- Authentication is OTP-only (V11 dropped password_hash).  Demo bypass
-- code "000000" works for every account when app.demo-mode=true.
INSERT INTO users (id, phone_number, name, email, role,
                   is_active, created_at)
VALUES
  ('40000001-0000-0000-0000-000000000001',
   '+919000000001', 'Anand Mehta',
   'owner@aes.com', 'SUPER_ADMIN',
   TRUE, NOW() - INTERVAL '900 days')
ON CONFLICT (id) DO NOTHING;

-- staff_profiles row so the workload board treats the owner like
-- any other staff member.  skills/localities are TEXT[] in this schema.
INSERT INTO staff_profiles (user_id, on_shift, branch, skills, localities, created_at, updated_at)
VALUES
  ('40000001-0000-0000-0000-000000000001', TRUE, 'HYDERABAD',
   ARRAY[]::text[], ARRAY[]::text[], NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ── 4) Slot every existing CRM / Engineer / Service Manager
--      into one of the 15 teams so the UI dropdowns aren't empty.
-- ============================================================
-- Demo distribution:
--   Team 01 — Ravi (CRM lead) + Rajesh (Eng)
--   Team 02 — Suresh (CRM lead) + Imran (Eng)
--   Team 03 — Sneha SM (lead) + Sandeep (Eng)
--   Teams 04-15 — empty "ready to staff" placeholders.  The owner
--                 can fill them later through the admin console.
-- ============================================================

UPDATE users SET team_name = 'Team 01', is_team_lead = TRUE
WHERE email = 'ravi.crm@aes.com';

UPDATE users SET team_name = 'Team 01'
WHERE email = 'rajesh.eng@aes.com';

UPDATE users SET team_name = 'Team 02', is_team_lead = TRUE
WHERE email = 'suresh.svc@aes.com';

UPDATE users SET team_name = 'Team 02'
WHERE email = 'imran.eng@aes.com';

UPDATE users SET team_name = 'Team 03', is_team_lead = TRUE
WHERE email = 'deepa.svc@aes.com';

UPDATE users SET team_name = 'Team 03'
WHERE email = 'sandeep.eng@aes.com';

UPDATE users SET team_name = 'Team 04', is_team_lead = TRUE
WHERE email = 'lakshmi.crm@aes.com';

-- ── 5) Helpful view used by /admin/teams and the CRM "assign"
--      dropdown.  Returns one row per team with the lead's name,
--      a member count, and a comma-separated member list.
-- ============================================================
DROP VIEW IF EXISTS team_roster_view CASCADE;
CREATE VIEW team_roster_view AS
SELECT  t.team_name,
        MAX(CASE WHEN u.is_team_lead THEN u.name           END) AS lead_name,
        -- Postgres has no MAX(uuid); cast through text for the demo view.
        MAX(CASE WHEN u.is_team_lead THEN u.id::text       END) AS lead_id,
        COUNT(u.id)                                             AS member_count,
        COUNT(u.id) FILTER (WHERE u.role = 'CRM_AGENT')         AS crm_count,
        COUNT(u.id) FILTER (WHERE u.role = 'SITE_ENGINEER')     AS engineer_count,
        STRING_AGG(u.name || ' (' || u.role || ')', ', ' ORDER BY u.name) AS members
FROM (
    -- Always materialise all 15 team rows even when empty
    SELECT 'Team ' || LPAD(generate_series(1,15)::text, 2, '0') AS team_name
) t
LEFT JOIN users u ON u.team_name = t.team_name AND u.is_active = TRUE
GROUP BY t.team_name
ORDER BY t.team_name;

COMMENT ON COLUMN users.team_name IS
    'V14 — which of the 15 named CRM teams this staff member belongs to. NULL for super admins, customers, etc.';
COMMENT ON COLUMN service_tickets.assigned_team_name IS
    'V14 — name of the team the CRM agent assigned this ticket to. Engineer is set via the engineer FK as before.';
