CREATE TABLE IF NOT EXISTS "bundle_jobs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "niche" text NOT NULL,
  "status" text NOT NULL DEFAULT 'generating',
  "total_count" integer NOT NULL DEFAULT 8,
  "completed_count" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0,
  "email_sent" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "bundle_jobs_user_id_idx" ON "bundle_jobs" ("user_id");
CREATE INDEX IF NOT EXISTS "bundle_jobs_status_idx" ON "bundle_jobs" ("status");
