ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS line_email TEXT,
ADD COLUMN IF NOT EXISTS line_picture_url TEXT,
ADD COLUMN IF NOT EXISTS line_status_message TEXT,
ADD COLUMN IF NOT EXISTS line_friendship_status BOOLEAN,
ADD COLUMN IF NOT EXISTS last_liff_profile JSONB,
ADD COLUMN IF NOT EXISTS last_liff_context JSONB;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS liff_profile_snapshot JSONB,
ADD COLUMN IF NOT EXISTS liff_context_snapshot JSONB;

COMMENT ON COLUMN public.customers.line_email IS 'Latest email address returned from LINE Login ID token verification when the email scope is granted.';
COMMENT ON COLUMN public.customers.line_picture_url IS 'Latest LINE main profile image URL verified from the LINE platform.';
COMMENT ON COLUMN public.customers.line_status_message IS 'Latest LINE profile status message retrieved from the LINE platform via access token.';
COMMENT ON COLUMN public.customers.line_friendship_status IS 'Friendship state between the customer and the linked LINE Official Account.';
COMMENT ON COLUMN public.customers.last_liff_profile IS 'Latest verified LINE profile snapshot captured during LIFF intake without storing raw tokens.';
COMMENT ON COLUMN public.customers.last_liff_context IS 'Latest LIFF runtime context and granted-scope snapshot captured during intake.';
COMMENT ON COLUMN public.leads.billing_address IS 'Billing or document address captured from the customer during intake.';
COMMENT ON COLUMN public.leads.liff_profile_snapshot IS 'Point-in-time verified LINE profile snapshot captured when the lead was submitted.';
COMMENT ON COLUMN public.leads.liff_context_snapshot IS 'Point-in-time LIFF runtime context snapshot captured when the lead was submitted.';
