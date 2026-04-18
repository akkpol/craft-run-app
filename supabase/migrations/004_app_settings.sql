CREATE TABLE app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  business_name TEXT,
  business_phone TEXT,
  business_email TEXT,
  line_channel_access_token TEXT,
  line_channel_secret TEXT,
  liff_id TEXT,
  base_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION set_app_settings_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;