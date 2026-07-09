-- Add stock limit to POD products (null = unlimited)
ALTER TABLE "pod_products" ADD COLUMN IF NOT EXISTS "stock_limit" integer;
