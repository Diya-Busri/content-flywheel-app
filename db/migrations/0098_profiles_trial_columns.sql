ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "trial_started_at" timestamp;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "trial_cancelled_at" timestamp;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "trial_converted" boolean DEFAULT false;
