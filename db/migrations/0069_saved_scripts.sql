-- Scripts saved from AI Coach (YouTube Strategy) for Video Timeline.
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
