ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "vat_enabled" boolean DEFAULT false;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "vat_rate" integer DEFAULT 20;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "vat_number" text;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "business_name" text;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "business_address" text;
