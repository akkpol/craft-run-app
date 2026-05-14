-- Restrict direct REST/RPC execution for commercial payment confirmation.
-- The server route uses the Supabase service role through createAdminClient().
-- Browser/client roles must not be able to call this SECURITY DEFINER function.

revoke execute on function public.confirm_commercial_payment(
  uuid,
  numeric,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.confirm_commercial_payment(
  uuid,
  numeric,
  text,
  timestamptz
) to service_role;
