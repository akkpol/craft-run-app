ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS fulfillment_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_subdistrict TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_district TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_province TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_postal_code TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS fulfillment_longitude DOUBLE PRECISION;

ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_fulfillment_mode_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_fulfillment_mode_check
CHECK (fulfillment_mode IN ('pickup', 'delivery', 'install'));

ALTER TABLE public.leads
ALTER COLUMN fulfillment_mode SET DEFAULT 'delivery';

NOTIFY pgrst, 'reload schema';
