-- Auto-transition jobs.fulfillment_status = 'delivered' when an install
-- is marked done from the public proof endpoint.
--
-- Closes the loop from PR #67: the install team was marking the
-- installation row as done, but the job's fulfillment_status stayed at
-- 'not_ready'/'ready' and admin had to flip it manually. The atomic
-- transition belongs inside the same RPC so two team submissions can't
-- race and so the job mutation can't lose the parent state of the
-- installation that triggered it.
--
-- Conditions:
-- - Only when p_mark_done = TRUE (admin still drives mid-progress).
-- - Only when jobs.fulfillment_status is one of the unfilled states
--   ('not_ready', 'ready'); we never overwrite 'picked_up' or
--   'delivered' to avoid a backward write race.
--
-- The job's overall status (NEW/IN_PRODUCTION/READY_FOR_FULFILLMENT/
-- COMPLETED) stays under the workflow-policy route as before — admin
-- still drives that final COMPLETED click for accounting + customer
-- timeline reasons.

CREATE OR REPLACE FUNCTION public.append_installation_proof(
  p_public_token TEXT,
  p_storage_path TEXT,
  p_mark_done BOOLEAN DEFAULT FALSE,
  p_completed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  job_id UUID,
  status TEXT,
  photo_count INTEGER,
  job_fulfillment_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_installation_row RECORD;
  v_job_fulfillment_status TEXT;
BEGIN
  UPDATE public.installations AS i
  SET
    photo_proof_paths = array_append(i.photo_proof_paths, p_storage_path),
    status = CASE WHEN p_mark_done THEN 'done' ELSE i.status END,
    completed_at = CASE
      WHEN p_mark_done THEN COALESCE(i.completed_at, p_completed_at)
      ELSE i.completed_at
    END,
    updated_at = NOW()
  WHERE i.public_token = p_public_token
    AND i.status IN ('scheduled', 'in_progress')
  RETURNING
    i.id,
    i.job_id,
    i.status,
    cardinality(i.photo_proof_paths) AS photo_count
  INTO v_installation_row;

  -- If the row didn't update (status already done/cancelled), bail with
  -- empty result so the caller returns 409 like before.
  IF v_installation_row.id IS NULL THEN
    RETURN;
  END IF;

  -- Auto-transition the job when the install just flipped to done.
  IF p_mark_done THEN
    UPDATE public.jobs AS j
    SET
      fulfillment_status = 'delivered',
      updated_at = NOW()
    WHERE j.id = v_installation_row.job_id
      AND j.fulfillment_status IN ('not_ready', 'ready')
    RETURNING j.fulfillment_status
    INTO v_job_fulfillment_status;
  ELSE
    SELECT j.fulfillment_status
      INTO v_job_fulfillment_status
      FROM public.jobs j
     WHERE j.id = v_installation_row.job_id;
  END IF;

  RETURN QUERY
  SELECT
    v_installation_row.id,
    v_installation_row.job_id,
    v_installation_row.status,
    v_installation_row.photo_count,
    v_job_fulfillment_status;
END;
$$;

COMMENT ON FUNCTION public.append_installation_proof(TEXT, TEXT, BOOLEAN, TIMESTAMPTZ) IS
  'Atomically append an install proof path; when p_mark_done flips status to ''done'' the parent job''s fulfillment_status auto-advances to ''delivered'' provided it was still in an unfilled state.';

REVOKE EXECUTE ON FUNCTION public.append_installation_proof(
  TEXT,
  TEXT,
  BOOLEAN,
  TIMESTAMPTZ
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.append_installation_proof(
  TEXT,
  TEXT,
  BOOLEAN,
  TIMESTAMPTZ
) TO service_role;
