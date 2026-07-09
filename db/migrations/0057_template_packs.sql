-- Template packs for Template Studio (quotes, tips, affirmations, product_promo, tutorials).
CREATE TABLE IF NOT EXISTS template_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  pack_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  niche TEXT,
  brand_colour_primary TEXT,
  brand_colour_secondary TEXT,
  font_style TEXT,
  slides_json JSONB,
  captions_json JSONB,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_packs_user_id ON template_packs (user_id);
CREATE INDEX IF NOT EXISTS idx_template_packs_created_at ON template_packs (created_at DESC);

ALTER TABLE template_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_packs_select_own" ON template_packs;
CREATE POLICY "template_packs_select_own" ON template_packs FOR SELECT USING (true);

DROP POLICY IF EXISTS "template_packs_insert_own" ON template_packs;
CREATE POLICY "template_packs_insert_own" ON template_packs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "template_packs_update_own" ON template_packs;
CREATE POLICY "template_packs_update_own" ON template_packs FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "template_packs_delete_own" ON template_packs;
CREATE POLICY "template_packs_delete_own" ON template_packs FOR DELETE USING (true);
