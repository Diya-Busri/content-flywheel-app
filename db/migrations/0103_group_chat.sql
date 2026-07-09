ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "group_name" text;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "group_description" text;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "group_avatar_url" text;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
