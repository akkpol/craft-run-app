-- Delivery tracking link + provider (P0 gap #6 from SALES_JOB_FULL_FLOW.md).
--
-- Admin books Lalamove / Grab / Kerry / etc. on the courier's own
-- dashboard, then pastes the public tracking link into the job. The
-- customer status page renders the link so the customer can track
-- delivery without going through LINE chat.
--
-- v1 keeps this as plain data — no courier API integration. Cron-style
-- status polling is left for a follow-up packet.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS delivery_provider TEXT
    CHECK (delivery_provider IN ('lalamove', 'grab', 'kerry', 'flash', 'thaipost', 'inhouse', 'other')),
  ADD COLUMN IF NOT EXISTS delivery_tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

COMMENT ON COLUMN public.jobs.delivery_provider IS
  'Courier service identifier. NULL = no delivery booked yet. ''inhouse'' = shop''s own driver.';
COMMENT ON COLUMN public.jobs.delivery_tracking_url IS
  'Public courier tracking URL the customer can open to see live delivery status.';
COMMENT ON COLUMN public.jobs.delivery_tracking_number IS
  'Booking / shipment number from the courier. Shown to customer for support calls.';
COMMENT ON COLUMN public.jobs.delivery_dispatched_at IS
  'Timestamp when the job left the shop (admin-entered). Used in customer status timeline.';
