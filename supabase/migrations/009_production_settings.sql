ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS production_upload_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS production_customer_auto_send_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS production_asset_retention_days INTEGER NOT NULL DEFAULT 30;
