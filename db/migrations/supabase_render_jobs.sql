-- Run this in Supabase SQL Editor to create render_jobs table.
-- user_id is text to support Clerk (app uses Clerk for auth).
-- Includes error and payload columns required by the app.

CREATE TABLE IF NOT EXISTS "render_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "video_url" text,
  "error" text,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only see their own render jobs
ALTER TABLE "render_jobs" ENABLE ROW LEVEL SECURITY;

-- Policy: users can select only their own jobs
CREATE POLICY "Users can view own render jobs"
  ON "render_jobs"
  FOR SELECT
  USING ("user_id" = auth.uid()::text);

-- Policy: users can insert jobs for themselves
CREATE POLICY "Users can insert own render jobs"
  ON "render_jobs"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid()::text);

-- Policy: users can update only their own jobs (needed for status polling / process-render updates)
-- Note: process-render runs server-side; if using service role, RLS is bypassed.
CREATE POLICY "Users can update own render jobs"
  ON "render_jobs"
  FOR UPDATE
  USING ("user_id" = auth.uid()::text);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS "render_jobs_user_id_idx" ON "render_jobs" ("user_id");
