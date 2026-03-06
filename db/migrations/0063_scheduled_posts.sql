-- Scheduled posts: content queued for date/time and platform. Manual "time to post" for now.
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_json JSONB NOT NULL,
  platform TEXT NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  posted_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts (scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_posted_status ON scheduled_posts (posted_status);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_posts_select_own" ON scheduled_posts;
CREATE POLICY "scheduled_posts_select_own" ON scheduled_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "scheduled_posts_insert_own" ON scheduled_posts;
CREATE POLICY "scheduled_posts_insert_own" ON scheduled_posts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "scheduled_posts_update_own" ON scheduled_posts;
CREATE POLICY "scheduled_posts_update_own" ON scheduled_posts FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "scheduled_posts_delete_own" ON scheduled_posts;
CREATE POLICY "scheduled_posts_delete_own" ON scheduled_posts FOR DELETE USING (true);
