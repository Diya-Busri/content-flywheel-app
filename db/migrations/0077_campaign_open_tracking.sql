ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "open_count" integer NOT NULL DEFAULT 0;
