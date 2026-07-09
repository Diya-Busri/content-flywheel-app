-- Connected accounts: OAuth tokens per user per platform for auto-publishing.
CREATE TABLE IF NOT EXISTS "connected_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "expires_at" timestamp,
  "scopes" text,
  "platform_user_id" text,
  "platform_username" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_user_platform"
  ON "connected_accounts" ("user_id", "platform");
