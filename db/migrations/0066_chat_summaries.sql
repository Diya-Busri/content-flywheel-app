-- AI Coach chat summaries for memory feature.
CREATE TABLE IF NOT EXISTS chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_summaries_user_id ON chat_summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_created_at ON chat_summaries (created_at DESC);
