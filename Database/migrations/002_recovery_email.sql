-- Run once on an existing May Day PostgreSQL volume before enabling email recovery.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS pending_recovery_email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verify_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verify_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reset_sent_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_recovery_email_lower
  ON users (lower(recovery_email)) WHERE recovery_email IS NOT NULL;

INSERT INTO api_endpoints (name, method, path, description, is_public) VALUES
  ('requestRecoveryEmail', 'POST', '/api/v1/auth/recovery-email', 'Gửi OTP xác minh email khôi phục', 0),
  ('verifyRecoveryEmail', 'POST', '/api/v1/auth/recovery-email/verify', 'Xác minh email khôi phục', 0)
ON CONFLICT (method, path) DO NOTHING;

INSERT INTO permissions_endpoints (permission_id, endpoint_id)
SELECT p.permission_id, e.endpoint_id
FROM permissions p
JOIN api_endpoints e ON e.method = 'POST'
 AND e.path IN ('/api/v1/auth/recovery-email', '/api/v1/auth/recovery-email/verify')
WHERE p.name = 'auth.change_password'
ON CONFLICT DO NOTHING;

COMMIT;
