-- Add marketing_assets jsonb for marketplace listing copy and thumbnail
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marketing_assets" jsonb;
