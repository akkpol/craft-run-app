-- Remote-only repair migration placeholder.
--
-- The linked Supabase project records version 20260423142830 with the name
-- repair_workflow_state_model_drift. GitHub Supabase Preview fails when that
-- remote version is absent from the local migrations directory.
--
-- The dashboard modal available in this checkout exposes only a truncated body,
-- so we intentionally keep this file as a no-op instead of committing inferred
-- repair SQL that could mutate fresh databases incorrectly.
--
-- If the authoritative SQL is later recovered from a trusted source, replace the
-- body of this file in place without changing the filename or version.

DO $$
BEGIN
  NULL;
END $$;