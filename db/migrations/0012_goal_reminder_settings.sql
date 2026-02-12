-- Goal reminder email settings per user
CREATE TABLE IF NOT EXISTS "goal_reminder_settings" (
  "user_id" text PRIMARY KEY,
  "enabled" boolean DEFAULT false NOT NULL,
  "local_hour" integer DEFAULT 9 NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
