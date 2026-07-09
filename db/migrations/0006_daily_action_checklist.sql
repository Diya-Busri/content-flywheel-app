-- Daily Action Checklist: time commitment + task duration + how-to
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "daily_time_commitment" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "duration" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "how_to_complete" text;
