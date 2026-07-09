-- Remove the old (user_id, platform) unique index that prevents multiple YouTube
-- channels per user. Migration 0073 attempted this via DROP INDEX but it may not
-- have run in all environments. This migration uses both forms to guarantee removal.

ALTER TABLE "connected_accounts" DROP CONSTRAINT IF EXISTS "connected_accounts_user_platform";
DROP INDEX IF EXISTS "connected_accounts_user_platform";

-- Ensure the correct multi-account index exists (allows multiple rows per platform
-- as long as platform_user_id differs — NULLs are never considered equal in Postgres
-- unique indexes, so multiple NULL platform_user_id rows are permitted).
CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_user_platform_user"
  ON "connected_accounts" ("user_id", "platform", "platform_user_id");
