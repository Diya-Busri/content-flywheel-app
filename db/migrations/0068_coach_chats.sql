-- AI Coach chat list: title, created_at, is_pinned (messages stay in client).
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
