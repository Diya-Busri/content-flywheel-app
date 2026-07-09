-- Soft delete: add deleted_at so items can be restored from Trash
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "scripts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
