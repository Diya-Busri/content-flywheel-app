-- Founder OS: admin-only workspace entries table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "founder_workspace_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "category" text NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
