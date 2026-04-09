-- ============================================================
-- Production DB Migrations
-- Run these in Supabase → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- 1. Product Bundles
CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  product_ids TEXT[] NOT NULL DEFAULT '{}',
  bundle_price INTEGER NOT NULL,
  stripe_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Product Waitlists
CREATE TABLE IF NOT EXISTS product_waitlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. Affiliate Links + Commissions
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  affiliate_name TEXT NOT NULL,
  affiliate_email TEXT,
  code TEXT NOT NULL UNIQUE,
  commission_percent INTEGER NOT NULL DEFAULT 20,
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_link_id UUID NOT NULL REFERENCES affiliate_links(id),
  creator_user_id TEXT NOT NULL,
  order_session_id TEXT NOT NULL,
  product_title TEXT,
  amount_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. Product Reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ============================================================
-- Done! All 5 tables created.
-- ============================================================
