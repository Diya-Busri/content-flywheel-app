CREATE TABLE IF NOT EXISTS "caption_library" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL DEFAULT '',
  "caption" text NOT NULL,
  "hashtags" text NOT NULL DEFAULT '',
  "platform" text NOT NULL DEFAULT 'all',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "caption_library_user_id_idx" ON "caption_library" ("user_id");
