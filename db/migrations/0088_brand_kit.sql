ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "accent_color" text NOT NULL DEFAULT '#f97316';
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "primary_font" text NOT NULL DEFAULT 'Inter';
