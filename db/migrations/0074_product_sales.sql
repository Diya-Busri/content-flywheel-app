-- Migration: product_sales table
-- Run this in Supabase SQL editor or via drizzle-kit push

CREATE TABLE IF NOT EXISTS "product_sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "product_id" uuid NOT NULL,
  "platform" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "note" text,
  "sold_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for fast per-user, per-product lookups
CREATE INDEX IF NOT EXISTS "product_sales_user_id_idx" ON "product_sales" ("user_id");
CREATE INDEX IF NOT EXISTS "product_sales_product_id_idx" ON "product_sales" ("product_id");
