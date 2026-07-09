-- Proof description and validation tracking for daily_tasks
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_description" text DEFAULT '' NOT NULL;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "validation_status" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "validation_reason" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "validation_confidence" text;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "rejection_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "validated_at" timestamp;

-- Backfill proof_description from proof_text for existing rows (optional)
UPDATE "daily_tasks" SET "proof_description" = COALESCE("proof_text", '') WHERE "proof_description" = '' AND "proof_text" IS NOT NULL;
