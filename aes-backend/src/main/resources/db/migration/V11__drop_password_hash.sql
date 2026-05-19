-- V11: Remove staff password column.
--
-- We've consolidated authentication on the OTP flow (`/api/v1/auth/verify-otp`)
-- for every role — customers, ops managers, CRM agents, engineers, service
-- managers and admins. Staff users already exist in `users` with the correct
-- role, so the existing OTP verification path resolves them automatically;
-- no password is required.
--
-- This migration:
--   1. Drops the `users.password_hash` column.
--   2. The `User` entity (Java) no longer maps it, so `ddl-auto=validate`
--      stays green.
--   3. Demo OTP bypass (`000000`) keeps working for every staff persona
--      because it short-circuits inside OtpService regardless of role.

ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
