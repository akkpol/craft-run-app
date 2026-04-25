-- Allow fresh-restart intake flow to persist superseded leads.
-- This stays idempotent so the migration can be reapplied safely in a dirty local DB.

ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_status_check;

UPDATE leads
SET status = 'superseded'
WHERE superseded_at IS NOT NULL
  AND status <> 'superseded';

ALTER TABLE leads
ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new',
    'quoted',
    'approved',
    'in_progress',
    'completed',
    'cancelled',
    'superseded'
  )) NOT VALID;

ALTER TABLE leads
VALIDATE CONSTRAINT leads_status_check;
