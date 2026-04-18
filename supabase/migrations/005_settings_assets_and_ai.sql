ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS business_logo_url TEXT,
ADD COLUMN IF NOT EXISTS business_catalog_url TEXT,
ADD COLUMN IF NOT EXISTS business_catalog_name TEXT,
ADD COLUMN IF NOT EXISTS ai_image_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_image_provider TEXT DEFAULT 'openai'
  CHECK (ai_image_provider IN ('openai')),
ADD COLUMN IF NOT EXISTS ai_image_model TEXT DEFAULT 'gpt-image-1',
ADD COLUMN IF NOT EXISTS ai_image_api_key TEXT;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS ai_image_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_image_status TEXT NOT NULL DEFAULT 'not_requested'
  CHECK (ai_image_status IN ('not_requested', 'pending', 'generated', 'failed')),
ADD COLUMN IF NOT EXISTS ai_generated_images JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_image_error TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-assets',
  'app-assets',
  TRUE,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;