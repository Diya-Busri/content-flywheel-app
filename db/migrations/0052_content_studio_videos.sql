-- Content Studio video library (Clerk user_id as TEXT)
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
