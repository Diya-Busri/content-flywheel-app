-- Skip day token (1 per week)
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "last_skipped_at" timestamp;
