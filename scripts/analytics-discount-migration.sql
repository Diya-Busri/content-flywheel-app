-- Product views table (analytics)
CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  referrer TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at ON product_views(viewed_at);

-- Creator promo / discount codes
CREATE TABLE IF NOT EXISTS creator_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  discount_percent INTEGER,
  discount_amount INTEGER,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_creator_promo_codes_user_id ON creator_promo_codes(creator_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_promo_codes_user_code ON creator_promo_codes(creator_user_id, UPPER(code));
