-- Per-line discount on quote_items (P1 from SALES_JOB_FULL_FLOW.md).
--
-- Today quote_items has only qty + unit_price; admin can't record a
-- promo, bulk, or loyalty discount on a single line — the only knob is
-- quotes.discount which applies to the whole quote, and even that has
-- no UI. This migration adds quote_items.discount and re-derives
-- line_total to subtract it.
--
-- line_total used to be GENERATED ALWAYS AS (qty * unit_price). The
-- generated formula has to change to (qty * unit_price - discount), so
-- we drop and re-add the column. Postgres won't let us ALTER the
-- generation expression in place. All downstream readers continue to
-- consume `line_total` as a regular numeric column, so this is a pure
-- formula change.
--
-- Unit (sqm vs piece) is intentionally NOT added here — see Wave 5
-- follow-up. Adding unit-aware pricing touches /api/intake price
-- calculation and product_catalog_items, which is a bigger scope.

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0
    CHECK (discount >= 0);

COMMENT ON COLUMN public.quote_items.discount IS
  'Per-line discount in baht. Subtracted from (qty * unit_price) when computing line_total. Default 0.';

-- Drop and recreate line_total with the new formula. The CHECK above
-- ensures discount can never push the line negative; GREATEST is a
-- defensive belt in case any historical row violates it.
ALTER TABLE public.quote_items
  DROP COLUMN IF EXISTS line_total;

ALTER TABLE public.quote_items
  ADD COLUMN line_total NUMERIC
    GENERATED ALWAYS AS (
      GREATEST(((qty)::numeric * unit_price) - discount, 0)
    ) STORED;

COMMENT ON COLUMN public.quote_items.line_total IS
  'Computed: GREATEST(qty * unit_price - discount, 0). Discount per line never makes the line negative.';
