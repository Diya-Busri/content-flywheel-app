-- Task category for balance and grouping
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "category" text;
