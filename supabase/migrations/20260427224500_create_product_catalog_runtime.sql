CREATE TABLE IF NOT EXISTS public.product_catalog_items (
  value TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  per_sqm NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS product_catalog_items_active_sort_idx
  ON public.product_catalog_items (active, sort_order, label);

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS product_label_snapshot TEXT,
ADD COLUMN IF NOT EXISTS product_category_snapshot TEXT,
ADD COLUMN IF NOT EXISTS product_category_label_snapshot TEXT;

COMMENT ON TABLE public.product_catalog_items IS 'Runtime-managed product catalog used by LIFF intake and document surfaces.';
COMMENT ON COLUMN public.product_catalog_items.value IS 'Stable machine key for the product, used as product_type in leads.';
COMMENT ON COLUMN public.product_catalog_items.label IS 'Customer-facing product label.';
COMMENT ON COLUMN public.product_catalog_items.category IS 'Machine category key used for grouping/filtering.';
COMMENT ON COLUMN public.product_catalog_items.category_label IS 'Customer-facing category label.';
COMMENT ON COLUMN public.product_catalog_items.description IS 'Optional short product description shown in selection UIs.';
COMMENT ON COLUMN public.product_catalog_items.keywords IS 'Optional search keywords for the LIFF picker and future matching.';
COMMENT ON COLUMN public.product_catalog_items.per_sqm IS 'Price rate per square meter used for auto-quote calculation.';
COMMENT ON COLUMN public.product_catalog_items.min_charge IS 'Minimum charge applied when auto-pricing the product.';
COMMENT ON COLUMN public.product_catalog_items.active IS 'Whether the product is selectable in runtime surfaces.';
COMMENT ON COLUMN public.product_catalog_items.sort_order IS 'Sort order for customer-facing product lists.';
COMMENT ON COLUMN public.leads.product_label_snapshot IS 'Point-in-time product label captured when the lead was submitted.';
COMMENT ON COLUMN public.leads.product_category_snapshot IS 'Point-in-time product category key captured when the lead was submitted.';
COMMENT ON COLUMN public.leads.product_category_label_snapshot IS 'Point-in-time product category label captured when the lead was submitted.';