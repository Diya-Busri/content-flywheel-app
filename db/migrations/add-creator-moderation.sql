-- Creator moderation columns for admin marketplace controls
-- Run this migration in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hidden_from_marketplace boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp;

-- Index for fast marketplace filtering
CREATE INDEX IF NOT EXISTS idx_profiles_hidden_from_marketplace
  ON profiles (hidden_from_marketplace)
  WHERE hidden_from_marketplace = true;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;
