-- Follow-up hardening of record_pickup_proof from PR #74 Codex review.
--
-- Two findings:
--
-- P1 (Codex) — the original migration created a SECURITY DEFINER RPC in
-- the public schema without revoking the default PUBLIC execute grant.
-- In Supabase/Postgres, anon/authenticated PostgREST clients could call
-- `record_pickup_proof` directly with any job UUID and pollute pickup
-- proof state without going through the admin route. The install-proof
-- RPC already follows the REVOKE-then-GRANT-to-service_role pattern; we
-- mirror that here.
--
-- P2 (Codex) — the RPC let p_mark_done flip fulfillment_status from
-- *either* 'not_ready' or 'ready'. That allowed an admin to close pickup
-- while the job was still in design/production, leaving `picked_up_at`
-- on a job whose workflow hadn't reached READY_FOR_FULFILLMENT yet, and
-- a later production transition could legitimately re-flip the status
-- backward. Tighten the gate so mark_done only succeeds when the job is
-- already ready for fulfillment.
--
-- L22: drop before re-create because we changed neither the input nor
-- the return signature, but the explicit DROP keeps re-running idempotent.

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

  IF v_prev_status IN ('picked_up', 'delivered') THEN
    RAISE EXCEPTION 'FULFILLMENT_ALREADY_CLOSED' USING ERRCODE = 'P0003';
  END IF;

  IF p_mark_done AND COALESCE(NULLIF(TRIM(p_recipient_name), ''), '') = ''
     AND COALESCE(NULLIF(TRIM(
           (SELECT pickup_recipient_name FROM public.jobs WHERE id = p_job_id)
         ), ''), '') = '' THEN
    RAISE EXCEPTION 'RECIPIENT_NAME_REQUIRED' USING ERRCODE = 'P0004';
  END IF;

  -- P2 fix: mark_done is the customer-leaves-with-goods event, so the
  -- job MUST already be ready_for_fulfillment. If production hasn't
  -- finished (status='not_ready'), refuse rather than silently leaving
  -- the flag at not_ready while picked_up_at is set.
  IF p_mark_done AND v_prev_status = 'not_ready' THEN
    RAISE EXCEPTION 'JOB_NOT_READY_FOR_PICKUP' USING ERRCODE = 'P0005';
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
          WHEN p_mark_done AND fulfillment_status = 'ready' THEN 'picked_up'
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
  'Atomically append a pickup proof photo and optionally flip jobs.fulfillment_status to picked_up. Requires fulfillment_status=ready for mark_done. Restricted to service_role; admin API is the only legitimate caller.';

-- P1 fix: revoke default PUBLIC grant, allow only the server-side
-- service_role JWT (used by createAdminClient) to call the function.
REVOKE EXECUTE ON FUNCTION public.record_pickup_proof(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_pickup_proof(
  UUID, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ
) TO service_role;
