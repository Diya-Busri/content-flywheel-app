-- Add provider and external_job_id for FaceSwap / multi-provider support
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "external_job_id" text;
