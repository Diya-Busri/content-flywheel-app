-- Brand voice: one row per user (user_id = Clerk id). For AI prompt context.
CREATE TABLE IF NOT EXISTS brand_voice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  brand_name TEXT,
  tone TEXT,
  target_audience TEXT,
  writing_style TEXT,
  example_phrases TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_voice_user_id ON brand_voice (user_id);

ALTER TABLE brand_voice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_voice_select_own" ON brand_voice;
CREATE POLICY "brand_voice_select_own" ON brand_voice FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_voice_insert_own" ON brand_voice;
CREATE POLICY "brand_voice_insert_own" ON brand_voice FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brand_voice_update_own" ON brand_voice;
CREATE POLICY "brand_voice_update_own" ON brand_voice FOR UPDATE USING (true) WITH CHECK (true);
