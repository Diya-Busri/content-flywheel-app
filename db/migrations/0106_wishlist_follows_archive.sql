-- Migration: Wishlist, Creator Follows, and Product Archive
-- Run this in Supabase SQL Editor

-- 1. Product wishlists — one row per user+product heart save
CREATE TABLE IF NOT EXISTS "product_wishlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "product_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_wishlists_user_product_idx"
  ON "product_wishlists" ("user_id", "product_id");

-- 2. Creator follows — one row per follower+followed pair
CREATE TABLE IF NOT EXISTS "creator_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "follower_id" text NOT NULL,
  "followed_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "creator_follows_follower_followed_idx"
  ON "creator_follows" ("follower_id", "followed_id");

-- Index for fast "who follows this creator?" lookups (for notifications + follower count)
CREATE INDEX IF NOT EXISTS "creator_follows_followed_id_idx"
  ON "creator_follows" ("followed_id");

-- 3. Archive column on products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;

-- Index to make "non-archived" queries fast
CREATE INDEX IF NOT EXISTS "products_archived_at_idx"
  ON "products" ("archived_at")
  WHERE "archived_at" IS NULL;
