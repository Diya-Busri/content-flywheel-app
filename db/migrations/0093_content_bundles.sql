CREATE TABLE IF NOT EXISTS "content_bundles" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" text NOT NULL,
  "title" text NOT NULL DEFAULT 'Untitled Bundle',
  "style" text NOT NULL DEFAULT 'minimal-luxury',
  "slide_count" integer NOT NULL DEFAULT 0,
  "cover_preview_url" text,
  "deleted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "content_bundles_user_id_idx" ON "content_bundles" ("user_id");

ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "bundle_id" uuid;
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "slide_index" integer;

CREATE INDEX IF NOT EXISTS "designs_bundle_id_idx" ON "designs" ("bundle_id");
