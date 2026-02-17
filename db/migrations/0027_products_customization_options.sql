-- Add customization options to products (Discovery step 7 options).
-- Run in Supabase SQL editor if not applied via migrations. Safe for existing rows (DEFAULT null).
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "customization_options" jsonb DEFAULT null;

COMMENT ON COLUMN "products"."customization_options" IS 'Discovery customization: numChapters, contentLength, tone, format-specific options';
