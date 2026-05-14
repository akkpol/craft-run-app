-- Commercial payment idempotency and receiver-lock confirmation.
-- Enforces: select receiver -> confirmed payment -> receiver lock -> quote/job unlock.

alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists idx_payments_idempotency_key
  on public.payments(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_payments_order_status_paid_at
  on public.payments(order_id, status, paid_at desc, created_at desc);

create or replace function public.confirm_commercial_payment(
  p_quote_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_paid_at timestamptz default now()
)
returns table (
  payment_id uuid,
  order_id uuid,
  receiver_entity_id uuid,
  payment_receiver_locked_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.commercial_orders%rowtype;
  v_existing_payment public.payments%rowtype;
  v_payment_id uuid;
  v_key text;
  v_paid_at timestamptz;
  v_locked_at timestamptz;
begin
  v_key := nullif(trim(p_idempotency_key), '');

  if v_key is null then
    raise exception 'PAYMENT_IDEMPOTENCY_KEY_REQUIRED: payment idempotency key is required.'
      using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'PAYMENT_AMOUNT_UNDERPAID: confirmed payment amount must be greater than zero.'
      using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_key)::bigint);

  select *
    into v_order
    from public.commercial_orders
   where quote_id = p_quote_id
   for update;

  if not found then
    raise exception 'COMMERCIAL_ORDER_NOT_FOUND: commercial order is required before confirming payment for quote %.',
      p_quote_id
      using errcode = 'P0001';
  end if;

  if v_order.selected_receiver_entity_id is null then
    raise exception 'RECEIVER_REQUIRED_BEFORE_PAYMENT: select receiver before confirming payment for quote %.',
      p_quote_id
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
      from public.commercial_entities
     where id = v_order.selected_receiver_entity_id
       and active = true
  ) then
    raise exception 'RECEIVER_ENTITY_INACTIVE: selected receiver entity is inactive for order %.',
      v_order.id
      using errcode = 'P0001';
  end if;

  select *
    into v_existing_payment
    from public.payments
   where idempotency_key = v_key
   for update;

  v_paid_at := coalesce(p_paid_at, now());

  if found then
    if v_existing_payment.order_id is distinct from v_order.id
      or v_existing_payment.receiver_entity_id is distinct from v_order.selected_receiver_entity_id
      or v_existing_payment.amount is distinct from p_amount
      or v_existing_payment.status is distinct from 'CONFIRMED'
    then
      raise exception 'PAYMENT_IDEMPOTENCY_CONFLICT: payment idempotency key % was already used for a different confirmation.',
        v_key
        using errcode = 'P0001';
    end if;

    if v_order.payment_receiver_locked_at is null then
      update public.commercial_orders
         set payment_receiver_locked_at = coalesce(v_existing_payment.paid_at, v_paid_at),
             updated_at = now()
       where id = v_order.id
       returning payment_receiver_locked_at into v_locked_at;
    else
      v_locked_at := v_order.payment_receiver_locked_at;
    end if;

    return query
      select
        v_existing_payment.id,
        v_order.id,
        v_order.selected_receiver_entity_id,
        v_locked_at,
        true;
    return;
  end if;

  insert into public.payments (
    order_id,
    receiver_entity_id,
    amount,
    status,
    paid_at,
    idempotency_key,
    created_at,
    updated_at
  )
  values (
    v_order.id,
    v_order.selected_receiver_entity_id,
    p_amount,
    'CONFIRMED',
    v_paid_at,
    v_key,
    now(),
    now()
  )
  returning id into v_payment_id;

  if v_order.payment_receiver_locked_at is null then
    update public.commercial_orders
       set payment_receiver_locked_at = v_paid_at,
           updated_at = now()
     where id = v_order.id
     returning payment_receiver_locked_at into v_locked_at;
  else
    v_locked_at := v_order.payment_receiver_locked_at;
  end if;

  return query
    select
      v_payment_id,
      v_order.id,
      v_order.selected_receiver_entity_id,
      v_locked_at,
      false;
end;
$$;

comment on function public.confirm_commercial_payment(uuid, numeric, text, timestamptz) is
  'Idempotently creates a CONFIRMED payment and locks the selected receiver before quote/workflow/job state can advance.';
