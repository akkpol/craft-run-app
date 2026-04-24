ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS payment_account_name TEXT,
ADD COLUMN IF NOT EXISTS payment_bank_name TEXT,
ADD COLUMN IF NOT EXISTS payment_account_number TEXT,
ADD COLUMN IF NOT EXISTS payment_promptpay_id TEXT,
ADD COLUMN IF NOT EXISTS payment_instructions TEXT;