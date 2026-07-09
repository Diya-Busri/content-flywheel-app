-- Add multi-placement designs support to pod_products
ALTER TABLE "pod_products" ADD COLUMN IF NOT EXISTS "placements" jsonb DEFAULT '[]'::jsonb;
