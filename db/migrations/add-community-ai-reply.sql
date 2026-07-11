-- AI community manager columns
-- Run once against your production database

ALTER TABLE academy_community_comments
  ADD COLUMN IF NOT EXISTS is_ai_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_helpful boolean;

ALTER TABLE academy_community_posts
  ADD COLUMN IF NOT EXISTS ai_replied_at timestamp;
