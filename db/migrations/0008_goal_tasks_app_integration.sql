-- Task type and app link for Content Flywheel integration
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "task_type" text DEFAULT 'external' NOT NULL;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "app_link" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "app_label" text;
