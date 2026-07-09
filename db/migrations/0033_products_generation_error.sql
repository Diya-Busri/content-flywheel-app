-- Store last generation error for failed products (format, niche, message logged separately)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "generation_error" text;
