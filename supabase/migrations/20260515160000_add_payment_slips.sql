-- Payment slip upload + verify (P0 gap from SALES_JOB_FULL_FLOW.md)
-- Customer uploads bank transfer slip via /quote/<token>/pay
-- Admin reviews queue + matches slip ↔ payment row

CREATE TABLE IF NOT EXISTS payment_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  original_file_name TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  uploader TEXT NOT NULL DEFAULT 'customer'
    CHECK (uploader IN ('customer', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'rejected')),
  matched_at TIMESTAMPTZ,
  matched_by_email TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_slips_quote
  ON payment_slips(quote_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_slips_pending
  ON payment_slips(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payment_slips_payment
  ON payment_slips(payment_id)
  WHERE payment_id IS NOT NULL;

COMMENT ON TABLE payment_slips IS
  'Bank transfer slips uploaded by customer (or admin) before/after confirm_commercial_payment. Admin reviews queue and matches each slip to a payments row.';
COMMENT ON COLUMN payment_slips.payment_id IS
  'Set to the payments row id after admin matches the slip. NULL means slip is pending review.';
COMMENT ON COLUMN payment_slips.status IS
  'pending = uploaded, awaiting admin review; matched = linked to payments row; rejected = admin marked invalid (wrong amount, fake slip, etc.)';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-slips',
  'payment-slips',
  FALSE,
  5242880,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE payment_slips ENABLE ROW LEVEL SECURITY;
