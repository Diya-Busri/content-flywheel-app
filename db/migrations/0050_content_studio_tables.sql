-- Content Studio tables (Supabase)
-- Requires: auth.users (Supabase Auth). Enable uuid-ossp for uuid_generate_v4().
-- If "videos" already exists in this DB (e.g. library schema), create the
-- Content Studio table under a different name (e.g. content_studio_videos).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. videos
-- =============================================================================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT,
  video_type TEXT,  -- 'youtube-long' | 'youtube-short' | 'tiktok'
  content_style TEXT,  -- 'faceless' | 'personal-brand'
  script_data JSONB,  -- hook, main points, CTAs
  timeline_data JSONB,  -- video timeline editor state
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'ready' | 'published'
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos (user_id);

-- RLS: users can only see/edit their own records (INSERT, SELECT, UPDATE)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_select_own" ON videos;
DROP POLICY IF EXISTS "videos_insert_own" ON videos;
DROP POLICY IF EXISTS "videos_update_own" ON videos;

CREATE POLICY "videos_select_own" ON videos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "videos_insert_own" ON videos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "videos_update_own" ON videos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- =============================================================================
-- 2. video_wizard_progress
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_wizard_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  topics TEXT,
  goal TEXT,
  selected_niche TEXT,
  video_type TEXT,
  content_style TEXT,
  script_strategy JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_wizard_progress_user_id ON video_wizard_progress (user_id);

-- RLS: users can only see/edit their own record (INSERT, SELECT, UPDATE)
ALTER TABLE video_wizard_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_wizard_progress_select" ON video_wizard_progress;
DROP POLICY IF EXISTS "video_wizard_progress_insert" ON video_wizard_progress;
DROP POLICY IF EXISTS "video_wizard_progress_update" ON video_wizard_progress;

CREATE POLICY "video_wizard_progress_select" ON video_wizard_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "video_wizard_progress_insert" ON video_wizard_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "video_wizard_progress_update" ON video_wizard_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
