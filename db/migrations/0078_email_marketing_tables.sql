-- Create email marketing tables if they don't exist yet, and add any missing columns.
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS column guards).

-- email_contacts table
CREATE TABLE IF NOT EXISTS "email_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "tags" text[] NOT NULL DEFAULT '{}',
  "subscribed_at" timestamp NOT NULL DEFAULT now(),
  "unsubscribed_at" timestamp
);

-- email_campaigns table
CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "subject" text NOT NULL,
  "preview_text" text,
  "body_html" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "sent_at" timestamp,
  "scheduled_for" timestamp,
  "open_count" integer NOT NULL DEFAULT 0,
  "recipient_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Add recipient_count to existing tables that predate this migration
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "recipient_count" integer NOT NULL DEFAULT 0;

-- Add any other columns that older installs may be missing
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "open_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp;
