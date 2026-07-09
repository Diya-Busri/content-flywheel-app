-- Template Studio setup: save mode + inputs per user for returning later
CREATE TABLE IF NOT EXISTS template_studio_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  inputs JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_studio_setup_user_id ON template_studio_setup (user_id);

ALTER TABLE template_studio_setup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_studio_setup_select_own" ON template_studio_setup;
CREATE POLICY "template_studio_setup_select_own" ON template_studio_setup FOR SELECT USING (true);

DROP POLICY IF EXISTS "template_studio_setup_insert_own" ON template_studio_setup;
CREATE POLICY "template_studio_setup_insert_own" ON template_studio_setup FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "template_studio_setup_update_own" ON template_studio_setup;
CREATE POLICY "template_studio_setup_update_own" ON template_studio_setup FOR UPDATE USING (true) WITH CHECK (true);
