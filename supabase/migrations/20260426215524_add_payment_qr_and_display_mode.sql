ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS payment_qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS payment_qr_code_label TEXT,
ADD COLUMN IF NOT EXISTS payment_display_mode TEXT NOT NULL DEFAULT 'all'
	CHECK (payment_display_mode IN ('all', 'account_only', 'qr_only', 'account_and_qr')),
ADD COLUMN IF NOT EXISTS payment_secondary_account_name TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_bank_name TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_account_number TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_promptpay_id TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_qr_code_label TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_display_mode TEXT NOT NULL DEFAULT 'all'
	CHECK (payment_secondary_display_mode IN ('all', 'account_only', 'qr_only', 'account_and_qr')),
ADD COLUMN IF NOT EXISTS payment_secondary_instructions TEXT,
ADD COLUMN IF NOT EXISTS payment_secondary_max_quote_total NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS payment_secondary_customer_scope TEXT NOT NULL DEFAULT 'none'
	CHECK (payment_secondary_customer_scope IN ('none', 'person', 'company', 'all')),
ADD COLUMN IF NOT EXISTS payment_secondary_payment_terms_scope TEXT NOT NULL DEFAULT 'none'
	CHECK (payment_secondary_payment_terms_scope IN ('none', 'prepaid', 'deposit', 'credit', 'non_credit', 'all'));

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS payment_profile_snapshot JSONB;

COMMENT ON COLUMN public.app_settings.payment_qr_code_url IS 'Public asset URL for the customer-facing payment QR code.';
COMMENT ON COLUMN public.app_settings.payment_qr_code_label IS 'Optional caption shown below the payment QR code on quote surfaces.';
COMMENT ON COLUMN public.app_settings.payment_display_mode IS 'Controls whether quotes show account details, QR code, or both.';
COMMENT ON COLUMN public.app_settings.payment_secondary_account_name IS 'Secondary payment profile account name used by auto-routing rules.';
COMMENT ON COLUMN public.app_settings.payment_secondary_bank_name IS 'Secondary payment profile bank name used by auto-routing rules.';
COMMENT ON COLUMN public.app_settings.payment_secondary_account_number IS 'Secondary payment profile account number used by auto-routing rules.';
COMMENT ON COLUMN public.app_settings.payment_secondary_promptpay_id IS 'Secondary payment profile PromptPay identifier.';
COMMENT ON COLUMN public.app_settings.payment_secondary_qr_code_url IS 'Secondary payment profile QR code image URL.';
COMMENT ON COLUMN public.app_settings.payment_secondary_qr_code_label IS 'Caption shown below the secondary payment QR code.';
COMMENT ON COLUMN public.app_settings.payment_secondary_display_mode IS 'How the secondary payment profile should be shown on quote surfaces.';
COMMENT ON COLUMN public.app_settings.payment_secondary_instructions IS 'Instructions shown when the auto-routing logic selects the secondary payment profile.';
COMMENT ON COLUMN public.app_settings.payment_secondary_max_quote_total IS 'Use the secondary payment profile when quote total is at or below this amount.';
COMMENT ON COLUMN public.app_settings.payment_secondary_customer_scope IS 'Use the secondary payment profile for matching billing entity types.';
COMMENT ON COLUMN public.app_settings.payment_secondary_payment_terms_scope IS 'Use the secondary payment profile for matching customer payment terms from intake.';
COMMENT ON COLUMN public.quotes.payment_profile_snapshot IS 'Resolved payment profile snapshot saved when the quote is created so published quotes stay deterministic.';
