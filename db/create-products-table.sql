-- Create products table (matches Drizzle schema + app uses Clerk so user_id is TEXT)
-- Run this in Supabase: SQL Editor → New query → Paste → Run
-- Or run migrations: npm run db:migrate

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "niche" text NOT NULL,
  "format" text NOT NULL,
  "content" jsonb NOT NULL DEFAULT '{}',
  "design_settings" jsonb DEFAULT '{"template":"modern","colors":{"primary":"#FF6B35","secondary":"#004E89","accent":"#F7B32B"},"typography":{"heading":"Inter","body":"Open Sans","size":16}}',
  "placed_elements" jsonb DEFAULT '[]',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Optional: enable RLS only if you use Supabase Auth for this app.
-- This app uses Clerk; if your DATABASE_URL uses a service role, RLS may be bypassed.
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own products" ON products FOR SELECT USING (auth.uid()::text = user_id);
-- CREATE POLICY "Users can insert own products" ON products FOR INSERT WITH CHECK (auth.uid()::text = user_id);
-- CREATE POLICY "Users can update own products" ON products FOR UPDATE USING (auth.uid()::text = user_id);
-- CREATE POLICY "Users can delete own products" ON products FOR DELETE USING (auth.uid()::text = user_id);
