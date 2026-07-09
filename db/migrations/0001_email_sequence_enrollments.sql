-- Run this in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS "email_sequence_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sequence_id" uuid NOT NULL,
  "product_id" text NOT NULL,
  "creator_user_id" text NOT NULL,
  "buyer_email" text NOT NULL,
  "enrolled_at" timestamp DEFAULT now() NOT NULL,
  "next_send_at" timestamp NOT NULL,
  "next_step_number" integer NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ese_pending_idx" ON "email_sequence_enrollments" ("completed", "next_send_at");
