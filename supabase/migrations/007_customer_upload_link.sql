ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS customer_upload_url TEXT,
ADD COLUMN IF NOT EXISTS customer_upload_label TEXT;
