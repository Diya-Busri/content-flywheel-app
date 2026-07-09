-- Stripe price ID for paywall (Content Flywheel Pro monthly/yearly)
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;
