-- Proof validation status: validated, validation_skipped, or null (legacy)
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "proof_validation_status" text;
