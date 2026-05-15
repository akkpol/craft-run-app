-- Atomic installation proof append. This keeps concurrent public-token uploads
-- from overwriting each other's photo_proof_paths array updates.

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
  photo_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
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
    cardinality(i.photo_proof_paths);
END;
$$;

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
