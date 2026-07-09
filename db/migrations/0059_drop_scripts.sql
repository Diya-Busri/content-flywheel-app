-- Brand Builder Drop Scripts: saved scripts by type (teaser, countdown, launch day, sold out).
CREATE TABLE IF NOT EXISTS drop_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  drop_type TEXT NOT NULL,
  vibe TEXT,
  milestone TEXT,
  script_type TEXT NOT NULL,
  hook TEXT NOT NULL,
  middle TEXT NOT NULL,
  cta TEXT NOT NULL,
  text_overlays JSONB,
  suggested_audio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drop_scripts_user_id ON drop_scripts (user_id);
CREATE INDEX IF NOT EXISTS idx_drop_scripts_created_at ON drop_scripts (created_at DESC);

ALTER TABLE drop_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drop_scripts_select_own" ON drop_scripts;
CREATE POLICY "drop_scripts_select_own" ON drop_scripts FOR SELECT USING (true);

DROP POLICY IF EXISTS "drop_scripts_insert_own" ON drop_scripts;
CREATE POLICY "drop_scripts_insert_own" ON drop_scripts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "drop_scripts_update_own" ON drop_scripts;
CREATE POLICY "drop_scripts_update_own" ON drop_scripts FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "drop_scripts_delete_own" ON drop_scripts;
CREATE POLICY "drop_scripts_delete_own" ON drop_scripts FOR DELETE USING (true);
