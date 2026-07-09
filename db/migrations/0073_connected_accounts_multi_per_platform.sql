-- Allow multiple accounts per platform (e.g., multiple YouTube channels) per user.
DROP INDEX IF EXISTS "connected_accounts_user_platform";

CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_user_platform_user"
  ON "connected_accounts" ("user_id", "platform", "platform_user_id");

