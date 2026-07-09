-- Content Studio create wizard progress (Clerk user_id as TEXT)
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
