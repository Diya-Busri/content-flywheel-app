-- AI Coach settings per user (memory toggle, names).
CREATE TABLE IF NOT EXISTS coach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  memory_enabled BOOLEAN NOT NULL DEFAULT false,
  coach_name TEXT NOT NULL DEFAULT 'Coach',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_settings_user_id ON coach_settings (user_id);
