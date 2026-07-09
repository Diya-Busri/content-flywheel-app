-- User library items (e.g. AI-generated images from Coach).
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
