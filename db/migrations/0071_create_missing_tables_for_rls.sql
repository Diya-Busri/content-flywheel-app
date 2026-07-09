-- Create all tables that 0070_rls_missing_tables.sql expects for RLS.
-- Run this in Supabase SQL Editor if any were skipped ("table does not exist").
-- Uses IF NOT EXISTS so safe to run even when some tables already exist.
-- After running, run 0070_rls_missing_tables.sql again to enable RLS on the new tables.

-- 1. connected_accounts (0048)
CREATE TABLE IF NOT EXISTS "connected_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "expires_at" timestamp,
  "scopes" text,
  "platform_user_id" text,
  "platform_username" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_user_platform"
  ON "connected_accounts" ("user_id", "platform");

-- 2. workflow_progress (0049)
CREATE TABLE IF NOT EXISTS workflow_progress (
  user_id TEXT PRIMARY KEY NOT NULL,
  workflow_data JSONB NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. content_studio_wizard_progress (0051)
CREATE TABLE IF NOT EXISTS content_studio_wizard_progress (
  user_id TEXT PRIMARY KEY NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  topics TEXT,
  goal TEXT,
  selected_niche TEXT,
  video_type TEXT,
  content_style TEXT,
  script_strategy JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_studio_wizard_progress_user_id ON content_studio_wizard_progress (user_id);

-- 4. content_studio_videos (0052)
CREATE TABLE IF NOT EXISTS content_studio_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  video_type TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_studio_videos_user_id ON content_studio_videos (user_id);
CREATE INDEX IF NOT EXISTS idx_content_studio_videos_created_at ON content_studio_videos (created_at DESC);

-- 5. coach_settings (0065)
CREATE TABLE IF NOT EXISTS coach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  memory_enabled BOOLEAN NOT NULL DEFAULT false,
  coach_name TEXT NOT NULL DEFAULT 'Coach',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_settings_user_id ON coach_settings (user_id);

-- 6. chat_summaries (0066)
CREATE TABLE IF NOT EXISTS chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_user_id ON chat_summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON chat_summaries (created_at DESC);

-- 7. my_library (0067)
CREATE TABLE IF NOT EXISTS my_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_my_library_user_id ON my_library (user_id);
CREATE INDEX IF NOT EXISTS idx_my_library_created_at ON my_library (created_at DESC);

-- 8. coach_chats (0068)
CREATE TABLE IF NOT EXISTS coach_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_chats_user_id ON coach_chats (user_id);
CREATE INDEX IF NOT EXISTS idx_coach_chats_created_at ON coach_chats (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_chats_is_pinned ON coach_chats (user_id, is_pinned);

-- 9. saved_scripts (0069)
CREATE TABLE IF NOT EXISTS saved_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  scenes_json JSONB NOT NULL,
  voiceover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_scripts_user_id ON saved_scripts (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_scripts_created_at ON saved_scripts (created_at DESC);
