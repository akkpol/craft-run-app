-- Pickup proof of delivery (P1 gap from SALES_JOB_FULL_FLOW.md).
--
-- For jobs with leads.fulfillment_mode='pickup', the customer comes to the
-- shop to collect. Today admin manually flips fulfillment_status with no
-- evidence — disputes are impossible to resolve and the "delivered" record
-- carries no proof of who actually received the goods.
--
-- This migration mirrors the install-proof pattern (PR #67 + #72):
--   * Append-only photo array on jobs
--   * Recipient name + timestamp
--   * Atomic RPC that appends photo and optionally flips
--     fulfillment_status='picked_up' in one transaction
--
-- Unlike install proofs, pickup happens at the shop — admin handles the
-- recording (no public token, no mobile page). So the surface is just an
-- admin route + UI. Recipient signature canvas is a Wave 5 gap.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_proof_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS pickup_recipient_phone TEXT;

COMMENT ON COLUMN public.jobs.pickup_proof_paths IS
  'Array of storage paths inside the pickup-proofs bucket. Append-only via /api/admin/jobs/<id>/pickup.';
COMMENT ON COLUMN public.jobs.picked_up_at IS
  'Set by record_pickup_proof RPC when admin marks pickup done. Mirrors delivery_dispatched_at semantics for the pickup flow.';
COMMENT ON COLUMN public.jobs.pickup_recipient_name IS
  'Name of the person who came to collect — typed by admin at handoff. Required field for proof of delivery for v1.';

CREATE INDEX IF NOT EXISTS idx_jobs_picked_up_at
  ON public.jobs(picked_up_at DESC)
  WHERE picked_up_at IS NOT NULL;

-- Storage bucket — same allowed types and size limit as install-proofs so
-- the admin storage UI feels identical.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pickup-proofs',
  'pickup-proofs',
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

-- Atomic append-and-maybe-mark-done RPC.
--
-- L16: array_append must happen inside the DB; never read-then-write from JS.
-- L20: server gate — refuses pickups for non-pickup fulfillment modes and
--      for jobs already closed (delivered / picked_up).
-- L22: drop before re-create not needed here (new function name), but the
--      explicit DROP keeps re-running idempotent across local replays.

DROP FUNCTION IF EXISTS public.record_pickup_proof(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.record_pickup_proof(
  p_job_id UUID,
  p_storage_path TEXT,
  p_recipient_name TEXT DEFAULT NULL,
  p_recipient_phone TEXT DEFAULT NULL,
  p_mark_done BOOLEAN DEFAULT FALSE,
  p_picked_up_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  fulfillment_mode TEXT,
  fulfillment_status TEXT,
  picked_up_at TIMESTAMPTZ,
  photo_count INTEGER,
  recipient_name TEXT,
  auto_transition BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id UUID;
  v_lead_mode TEXT;
  v_prev_status TEXT;
  v_new_status TEXT;
  v_picked_up_at TIMESTAMPTZ;
  v_paths TEXT[];
  v_recipient_name TEXT;
  v_auto_transition BOOLEAN := FALSE;
BEGIN
  -- Lock job row + read its lead.fulfillment_mode in one statement.
  SELECT j.id, l.fulfillment_mode, j.fulfillment_status
    INTO v_job_id, v_lead_mode, v_prev_status
  FROM public.jobs j
  JOIN public.leads l ON l.id = j.lead_id
  WHERE j.id = p_job_id
  FOR UPDATE OF j;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_lead_mode IS DISTINCT FROM 'pickup' THEN
    RAISE EXCEPTION 'NOT_PICKUP_MODE' USING ERRCODE = 'P0002';
  END IF;

  -- Once fulfillment is finalized, refuse further proof uploads so a stale
  -- admin tab can't pollute a closed handoff record.
  IF v_prev_status IN ('picked_up', 'delivered') THEN
    RAISE EXCEPTION 'FULFILLMENT_ALREADY_CLOSED' USING ERRCODE = 'P0003';
  END IF;

  -- mark_done requires a recipient name (legal proof) — either now or already
  -- recorded on a prior call.
  IF p_mark_done AND COALESCE(NULLIF(TRIM(p_recipient_name), ''), '') = ''
     AND COALESCE(NULLIF(TRIM(
           (SELECT pickup_recipient_name FROM public.jobs WHERE id = p_job_id)
         ), ''), '') = '' THEN
    RAISE EXCEPTION 'RECIPIENT_NAME_REQUIRED' USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.jobs
  SET pickup_proof_paths =
        COALESCE(pickup_proof_paths, ARRAY[]::TEXT[]) || ARRAY[p_storage_path],
      pickup_recipient_name =
        COALESCE(NULLIF(TRIM(p_recipient_name), ''), pickup_recipient_name),
      pickup_recipient_phone =
        COALESCE(NULLIF(TRIM(p_recipient_phone), ''), pickup_recipient_phone),
      picked_up_at =
        CASE WHEN p_mark_done THEN p_picked_up_at ELSE picked_up_at END,
      fulfillment_status =
        CASE
          WHEN p_mark_done AND fulfillment_status IN ('not_ready', 'ready')
            THEN 'picked_up'
          ELSE fulfillment_status
        END,
      updated_at = NOW()
  WHERE id = p_job_id
  RETURNING
    jobs.fulfillment_status,
    jobs.picked_up_at,
    jobs.pickup_proof_paths,
    jobs.pickup_recipient_name
  INTO v_new_status, v_picked_up_at, v_paths, v_recipient_name;

  v_auto_transition := (v_prev_status IS DISTINCT FROM v_new_status)
                       AND v_new_status = 'picked_up';

  RETURN QUERY SELECT
    p_job_id,
    v_lead_mode,
    v_new_status,
    v_picked_up_at,
    COALESCE(array_length(v_paths, 1), 0),
    v_recipient_name,
    v_auto_transition;
END;
$$;

COMMENT ON FUNCTION public.record_pickup_proof IS
  'Atomically append a pickup proof photo and optionally flip jobs.fulfillment_status to picked_up. Refuses when fulfillment_mode != pickup, when fulfillment is already closed, or when marking done without a recipient name.';
