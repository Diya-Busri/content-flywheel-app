CREATE TABLE IF NOT EXISTS "design_history" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL DEFAULT 'Untitled Design',
  "image_url" text NOT NULL,
  "source_type" text NOT NULL DEFAULT 'studio',
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "design_history_user_id_idx" ON "design_history" ("user_id");
