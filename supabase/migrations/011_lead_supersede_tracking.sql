-- FOGUS ERP — Lead supersede tracking
-- Supports "fresh" LINE intake replacing the latest active lead while preserving auditability.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS superseded_by_lead_id UUID NULL REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS supersede_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_superseded_by_lead_id
  ON leads (superseded_by_lead_id);

CREATE INDEX IF NOT EXISTS idx_leads_superseded_at
  ON leads (superseded_at DESC);

COMMENT ON COLUMN leads.superseded_by_lead_id IS 'Lead that replaced this lead when the customer started a fresh request.';
COMMENT ON COLUMN leads.superseded_at IS 'When this lead was marked as replaced by a newer fresh request.';
COMMENT ON COLUMN leads.supersede_reason IS 'Human-readable explanation for why this lead was superseded.';
