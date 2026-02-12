-- Proof submission for task completion
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_required" boolean DEFAULT true NOT NULL;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_type" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_url" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_text" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_submitted_at" timestamp;
