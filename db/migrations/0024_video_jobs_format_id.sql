-- Add format_id for ranking format (drives video composition, overlay animation)
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "format_id" text;
