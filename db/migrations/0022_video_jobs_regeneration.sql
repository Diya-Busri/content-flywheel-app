-- Add regeneration tracking columns to video_jobs
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "parent_job_id" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "angle_type" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "script_id" text;
