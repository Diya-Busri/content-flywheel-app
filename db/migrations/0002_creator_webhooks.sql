-- Run this in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS "creator_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "events" text NOT NULL DEFAULT 'product_sold',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_status" text,
  "last_delivered_at" timestamp
);

CREATE INDEX IF NOT EXISTS "cw_user_active_idx" ON "creator_webhooks" ("user_id", "active");
