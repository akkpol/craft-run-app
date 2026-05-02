-- Commercial Document Policy v1 — Receiver lock immutability trigger
-- Packet: plan/feature-commercial-documents-1.md
-- Related: 20260502113000_add_commercial_document_core.sql
--
-- Once payment_receiver_locked_at is set on a commercial_order, it must
-- never be overwritten. This DB-level trigger enforces the policy invariant:
--   "payment receiver entity = document issuer entity" (Policy §7.4)
-- even if application code has a bug or if direct SQL bypasses the API.

create or replace function public.prevent_receiver_lock_overwrite()
returns trigger
language plpgsql
as $$
begin
  -- Allow the initial lock (was null, now being set).
  if OLD.payment_receiver_locked_at is null then
    return NEW;
  end if;

  -- If already locked, block any attempt to change it.
  if NEW.payment_receiver_locked_at is distinct from OLD.payment_receiver_locked_at then
    raise exception
      'PAYMENT_RECEIVER_LOCKED: payment_receiver_locked_at is immutable once set on order %.',
      OLD.id
      using errcode = 'P0001';
  end if;

  -- Also prevent changing the selected receiver entity once locked.
  if NEW.selected_receiver_entity_id is distinct from OLD.selected_receiver_entity_id then
    raise exception
      'PAYMENT_RECEIVER_LOCKED: selected_receiver_entity_id is immutable once payment is locked on order %.',
      OLD.id
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

comment on function public.prevent_receiver_lock_overwrite() is
  'Prevents overwriting payment_receiver_locked_at or selected_receiver_entity_id once locked. '
  'Enforces Commercial Document Policy v1 §7.4 at the database level.';

-- Drop and recreate to ensure idempotency across re-migrations.
drop trigger if exists trg_prevent_receiver_lock_overwrite
  on public.commercial_orders;

create trigger trg_prevent_receiver_lock_overwrite
  before update on public.commercial_orders
  for each row
  execute function public.prevent_receiver_lock_overwrite();
