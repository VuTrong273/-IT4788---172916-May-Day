-- A signed visit stays immutable while the home diary can remain active.
BEGIN;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS followup_active BOOLEAN NOT NULL DEFAULT true;
COMMIT;
