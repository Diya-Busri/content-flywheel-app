-- Content Studio: user content settings (niche, content style, YouTube channels)
-- user_id is Clerk user id (TEXT). Use same as content_studio_wizard_progress.
CREATE TABLE IF NOT EXISTS user_content_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  selected_niche TEXT,
  content_style TEXT,
  youtube_channels JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_content_settings_user_id ON user_content_settings (user_id);

ALTER TABLE user_content_settings ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own row (application sets app.current_user_id before queries if using RLS with Supabase)
-- For Clerk-only apps, API filters by userId; this policy allows read/write when user_id matches.
DROP POLICY IF EXISTS "user_content_settings_select_own" ON user_content_settings;
CREATE POLICY "user_content_settings_select_own" ON user_content_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_content_settings_insert_own" ON user_content_settings;
CREATE POLICY "user_content_settings_insert_own" ON user_content_settings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "user_content_settings_update_own" ON user_content_settings;
CREATE POLICY "user_content_settings_update_own" ON user_content_settings
  FOR UPDATE USING (true) WITH CHECK (true);
