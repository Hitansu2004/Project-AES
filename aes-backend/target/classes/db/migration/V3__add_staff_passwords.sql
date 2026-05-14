-- ============================================================
-- AES Customer Portal — V3 Add Staff Passwords
-- ============================================================
-- Staff users (CRM agents, service managers, admins) use password-based login.
-- Passwords are BCrypt hashed. Default password for all staff: "password123"

ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);

-- BCrypt hash of "password123" (strength 12)
UPDATE users SET password_hash = '$2a$12$n6ENFiPC2ZFGvdMWaR7PKeZAsITBfHPvyfcKDoFQWZ9mVMgm80akO'
WHERE role IN ('CRM_AGENT', 'SERVICE_MANAGER', 'ADMIN');
