-- Install scheduling + on-site proof (P0 gap #5 from SALES_JOB_FULL_FLOW.md).
--
-- Today `leads.fulfillment_mode='install'` exists but the system has no
-- schedule, team assignment, or completion proof. Admin manages installs
-- via LINE chat / spreadsheets. This migration adds a per-job
-- `installations` row tied by a public token so the on-site team can open
-- a mobile page, upload photos, and mark the install done without LINE.

CREATE TABLE IF NOT EXISTS public.installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  -- Denormalized so the public install page can resolve quote context
  -- without joining through jobs every request.
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  scheduled_at TIMESTAMPTZ,
  install_team TEXT,
  on_site_address TEXT,
  on_site_contact_name TEXT,
  on_site_contact_phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'done', 'cancelled')),
  photo_proof_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  completed_at TIMESTAMPTZ,
  completed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_installations_quote
  ON public.installations(quote_id);
CREATE INDEX IF NOT EXISTS idx_installations_scheduled
  ON public.installations(scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_installations_done
  ON public.installations(completed_at DESC)
  WHERE status = 'done';

COMMENT ON TABLE public.installations IS
  'On-site installation schedule + photo proof for jobs with fulfillment_mode=install. One installation row per job.';
COMMENT ON COLUMN public.installations.public_token IS
  'Random token used by /install/<token> mobile page for the on-site team. No login required — analogous to /quote/<token>.';
COMMENT ON COLUMN public.installations.photo_proof_paths IS
  'Array of storage paths inside the install-proofs bucket. Append-only via /api/install/<token>/proof — admin reviews before marking done.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'install-proofs',
  'install-proofs',
  FALSE,
  10485760,
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

ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
