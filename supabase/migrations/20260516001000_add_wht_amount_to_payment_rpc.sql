-- Extend confirm_commercial_payment to accept WHT amount and include it
-- in the cumulative outstanding check + persist on payments row.
--
-- Existing 4-arg callers (supabase.rpc with 4 named params) continue to
-- work because p_wht_amount defaults to 0.

-- Drop the old signature so we can replace it cleanly. CREATE OR REPLACE
-- can't change the parameter list, so we DROP first, then CREATE.
DROP FUNCTION IF EXISTS public.confirm_commercial_payment(
  uuid,
  numeric,
  text,
  timestamptz
);

CREATE OR REPLACE FUNCTION public.confirm_commercial_payment(
  p_quote_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_paid_at timestamptz DEFAULT now(),
  p_wht_amount numeric DEFAULT 0
)
RETURNS TABLE (
  payment_id uuid,
  order_id uuid,
  receiver_entity_id uuid,
  payment_receiver_locked_at timestamptz,
  reused boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.commercial_orders%ROWTYPE;
  v_existing_payment public.payments%ROWTYPE;
  v_payment_id uuid;
  v_key text;
  v_paid_at timestamptz;
  v_locked_at timestamptz;
  v_quote_total numeric;
  v_paid_total numeric;
  v_outstanding numeric;
  v_wht numeric;
BEGIN
  v_key := nullif(trim(p_idempotency_key), '');
  v_wht := coalesce(p_wht_amount, 0);

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_REQUIRED: payment idempotency key is required.'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_UNDERPAID: confirmed payment amount must be greater than zero.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_wht < 0 THEN
    RAISE EXCEPTION 'PAYMENT_WHT_INVALID: wht_amount must be >= 0.'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key)::bigint);

  SELECT *
    INTO v_order
    FROM public.commercial_orders
   WHERE quote_id = p_quote_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMERCIAL_ORDER_NOT_FOUND: commercial order is required before confirming payment for quote %.',
      p_quote_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.selected_receiver_entity_id IS NULL THEN
    RAISE EXCEPTION 'RECEIVER_REQUIRED_BEFORE_PAYMENT: select receiver before confirming payment for quote %.',
      p_quote_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.commercial_entities
     WHERE id = v_order.selected_receiver_entity_id
       AND active = true
  ) THEN
    RAISE EXCEPTION 'RECEIVER_ENTITY_INACTIVE: selected receiver entity is inactive for order %.',
      v_order.id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
    INTO v_existing_payment
    FROM public.payments
   WHERE idempotency_key = v_key
   FOR UPDATE;

  v_paid_at := coalesce(p_paid_at, now());

  IF FOUND THEN
    IF v_existing_payment.order_id IS DISTINCT FROM v_order.id
      OR v_existing_payment.receiver_entity_id IS DISTINCT FROM v_order.selected_receiver_entity_id
      OR v_existing_payment.amount IS DISTINCT FROM p_amount
      OR coalesce(v_existing_payment.wht_amount, 0) IS DISTINCT FROM v_wht
      OR v_existing_payment.status IS DISTINCT FROM 'CONFIRMED'
    THEN
      RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_CONFLICT: payment idempotency key % was already used for a different confirmation.',
        v_key
        USING ERRCODE = 'P0001';
    END IF;

    IF v_order.payment_receiver_locked_at IS NULL THEN
      UPDATE public.commercial_orders co
         SET payment_receiver_locked_at = coalesce(v_existing_payment.paid_at, v_paid_at),
             updated_at = now()
       WHERE co.id = v_order.id
       RETURNING co.payment_receiver_locked_at INTO v_locked_at;
    ELSE
      v_locked_at := v_order.payment_receiver_locked_at;
    END IF;

    RETURN QUERY
      SELECT
        v_existing_payment.id,
        v_order.id,
        v_order.selected_receiver_entity_id,
        v_locked_at,
        true;
    RETURN;
  END IF;

  SELECT coalesce(q.total, 0)
    INTO v_quote_total
    FROM public.quotes q
   WHERE q.id = p_quote_id
     AND q.payment_terms <> 'credit';

  IF FOUND THEN
    -- Cumulative balance includes both cash received (amount) AND withheld
    -- tax (wht_amount). The customer's obligation to the seller is fully
    -- discharged once amount + wht_amount across all confirmed payments
    -- reaches quote.total — the 50ทวิ certificate substitutes for the
    -- withheld portion.
    SELECT coalesce(sum(p.amount + coalesce(p.wht_amount, 0)), 0)
      INTO v_paid_total
      FROM public.payments p
     WHERE p.order_id = v_order.id
       AND p.status = 'CONFIRMED';

    v_outstanding := greatest(0, v_quote_total - coalesce(v_paid_total, 0));

    IF (p_amount + v_wht) > v_outstanding + 0.01 THEN
      RAISE EXCEPTION 'PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING: payment amount % + wht % exceeds outstanding balance % for quote %.',
        p_amount,
        v_wht,
        v_outstanding,
        p_quote_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.payments (
    order_id,
    receiver_entity_id,
    amount,
    wht_amount,
    status,
    paid_at,
    idempotency_key,
    created_at,
    updated_at
  )
  VALUES (
    v_order.id,
    v_order.selected_receiver_entity_id,
    p_amount,
    v_wht,
    'CONFIRMED',
    v_paid_at,
    v_key,
    now(),
    now()
  )
  RETURNING id INTO v_payment_id;

  IF v_order.payment_receiver_locked_at IS NULL THEN
    UPDATE public.commercial_orders co
       SET payment_receiver_locked_at = v_paid_at,
           updated_at = now()
     WHERE co.id = v_order.id
     RETURNING co.payment_receiver_locked_at INTO v_locked_at;
  ELSE
    v_locked_at := v_order.payment_receiver_locked_at;
  END IF;

  RETURN QUERY
    SELECT
      v_payment_id,
      v_order.id,
      v_order.selected_receiver_entity_id,
      v_locked_at,
      false;
END;
$$;

COMMENT ON FUNCTION public.confirm_commercial_payment(uuid, numeric, text, timestamptz, numeric) IS
  'Idempotently creates a CONFIRMED payment (including any withheld tax via p_wht_amount), locks the selected receiver, and enforces cumulative outstanding balance under the order row lock.';

-- Re-apply security restrictions on the new signature.
REVOKE EXECUTE ON FUNCTION public.confirm_commercial_payment(
  uuid,
  numeric,
  text,
  timestamptz,
  numeric
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_commercial_payment(
  uuid,
  numeric,
  text,
  timestamptz,
  numeric
) TO service_role;
