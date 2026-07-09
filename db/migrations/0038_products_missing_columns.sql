-- Add any products columns that may be missing (safe to run: IF NOT EXISTS).
-- Covers design_source and other columns added in later migrations so one run brings DB in sync with schema.

-- status (0003_library)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;

-- deleted_at (0004_soft_delete)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- customization_options (0027)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "customization_options" jsonb DEFAULT null;

-- marketing_assets (0029)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marketing_assets" jsonb;

-- bundle_id (0032)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bundle_id" uuid;

-- generation_error, generation_status (0034)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "generation_error" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "generation_status" text;

-- design_source: 'ai' | 'brand' | null — for library "AI Designed" badge (0037)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "design_source" text;
