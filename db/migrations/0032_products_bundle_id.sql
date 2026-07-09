-- Add bundle_id so bundle products can be grouped in My Library
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bundle_id" uuid;
