-- Saved templates: user-saved content for reuse (format_type = ebook, planner, copy_writer, script, etc.)
CREATE TABLE IF NOT EXISTS saved_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format_type TEXT NOT NULL,
  tags TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_templates_user_id ON saved_templates (user_id);

ALTER TABLE saved_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_templates_select_own" ON saved_templates;
CREATE POLICY "saved_templates_select_own" ON saved_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "saved_templates_insert_own" ON saved_templates;
CREATE POLICY "saved_templates_insert_own" ON saved_templates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "saved_templates_update_own" ON saved_templates;
CREATE POLICY "saved_templates_update_own" ON saved_templates FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "saved_templates_delete_own" ON saved_templates;
CREATE POLICY "saved_templates_delete_own" ON saved_templates FOR DELETE USING (true);
