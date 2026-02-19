-- Add generation_error and generation_status to products (Supabase-safe: IF NOT EXISTS)
-- generation_error: last error message when generation fails
-- generation_status: 'pending' | 'generating' | 'complete' | 'failed' | 'partial'
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "generation_error" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "generation_status" text;
