-- 4-day content workflow: save/resume progress per user
CREATE TABLE IF NOT EXISTS workflow_progress (
  user_id TEXT PRIMARY KEY NOT NULL,
  workflow_data JSONB NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
