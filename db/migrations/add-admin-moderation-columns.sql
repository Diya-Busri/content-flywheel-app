-- Migration: Add admin marketplace moderation columns to products table
-- Run in Supabase SQL Editor

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS removed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT,
  ADD COLUMN IF NOT EXISTS staff_pick        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_homepage   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_notes       TEXT;

-- Index for efficient admin dashboard filtering
CREATE INDEX IF NOT EXISTS idx_products_removed_at        ON products (removed_at);
CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON products (moderation_status);
CREATE INDEX IF NOT EXISTS idx_products_staff_pick        ON products (staff_pick) WHERE staff_pick = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_pinned_homepage   ON products (pinned_homepage) WHERE pinned_homepage = TRUE;
