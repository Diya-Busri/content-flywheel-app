CREATE TABLE IF NOT EXISTS "bio_pages" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL DEFAULT '',
  "bio" text NOT NULL DEFAULT '',
  "avatar_url" text,
  "primary_color" text NOT NULL DEFAULT '#f97316',
  "links" text NOT NULL DEFAULT '[]',
  "show_waitlist" boolean NOT NULL DEFAULT true,
  "waitlist_cta" text NOT NULL DEFAULT 'Be first to know when we drop',
  "is_published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "waitlist_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "waitlist_entries_user_id_idx" ON "waitlist_entries" ("user_id");
