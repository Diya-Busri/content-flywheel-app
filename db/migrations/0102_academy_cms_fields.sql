ALTER TABLE "academy_courses" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';
ALTER TABLE "academy_courses" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "academy_courses" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "academy_courses" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false;
ALTER TABLE "academy_courses" ADD COLUMN IF NOT EXISTS "learning_outcomes" text;
ALTER TABLE "academy_courses" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "academy_community_posts" ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT false;
ALTER TABLE "academy_community_posts" ADD COLUMN IF NOT EXISTS "is_announcement" boolean NOT NULL DEFAULT false;
ALTER TABLE "academy_community_posts" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp;

-- Backfill status from legacy is_published for existing rows
UPDATE "academy_courses" SET "status" = 'published' WHERE "is_published" = true AND "status" = 'draft';
