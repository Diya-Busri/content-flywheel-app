-- design_source: 'ai' | 'brand' | null. When set, product was auto-designed (for library "AI Designed" badge).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "design_source" text;
