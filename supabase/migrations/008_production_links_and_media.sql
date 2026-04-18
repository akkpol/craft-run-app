CREATE TABLE job_production_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_production_links_job ON job_production_links(job_id);
CREATE INDEX idx_job_production_links_status ON job_production_links(status, expires_at);

CREATE OR REPLACE FUNCTION set_job_production_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_production_links_updated_at ON job_production_links;
CREATE TRIGGER trg_job_production_links_updated_at
BEFORE UPDATE ON job_production_links
FOR EACH ROW
EXECUTE FUNCTION set_job_production_links_updated_at();

CREATE TABLE job_media_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  production_link_id UUID NOT NULL REFERENCES job_production_links(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('proof', 'ready_for_production', 'completed')),
  note TEXT,
  submitted_by_label TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'sent')),
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  sent_to_customer_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_media_events_job ON job_media_events(job_id, created_at DESC);
CREATE INDEX idx_job_media_events_review_status ON job_media_events(review_status, created_at DESC);

CREATE TABLE job_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES job_media_events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER,
  width_px INTEGER,
  height_px INTEGER,
  deleted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_media_assets_event ON job_media_assets(event_id);
CREATE INDEX idx_job_media_assets_cleanup ON job_media_assets(deleted_at, expires_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-media',
  'job-media',
  FALSE,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE job_production_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_media_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_media_assets ENABLE ROW LEVEL SECURITY;
