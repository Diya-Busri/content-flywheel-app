-- Run in Supabase SQL Editor to fix "design_source does not exist" and ensure brand_profiles exists.

-- Products: add design_source and design_settings if missing
ALTER TABLE products ADD COLUMN IF NOT EXISTS design_source text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS design_settings jsonb;

-- Brand profiles: create table if it doesn't exist (matches app schema: primary_color, user_id as PK)
CREATE TABLE IF NOT EXISTS brand_profiles (
  user_id text PRIMARY KEY NOT NULL,
  tiktok_url text,
  instagram_url text,
  youtube_url text,
  facebook_url text,
  primary_color text NOT NULL DEFAULT '#1a1a1a',
  secondary_color text NOT NULL DEFAULT '#475569',
  logo_url text,
  prefer_ai_colors boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- RLS for brand_profiles (no-op if already applied)
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_brand_profiles_select ON brand_profiles;
DROP POLICY IF EXISTS rls_brand_profiles_insert ON brand_profiles;
DROP POLICY IF EXISTS rls_brand_profiles_update ON brand_profiles;
DROP POLICY IF EXISTS rls_brand_profiles_delete ON brand_profiles;
CREATE POLICY rls_brand_profiles_select ON brand_profiles FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY rls_brand_profiles_insert ON brand_profiles FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY rls_brand_profiles_update ON brand_profiles FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY rls_brand_profiles_delete ON brand_profiles FOR DELETE USING (user_id = auth.uid()::text);
