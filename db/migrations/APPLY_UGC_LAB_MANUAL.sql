-- Run this in Supabase SQL Editor or psql if video_jobs table is missing
-- Creates video_jobs with all required columns

CREATE TABLE IF NOT EXISTS "video_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "campaign_id" text,
  "batch_id" text NOT NULL,
  "parent_job_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "angle_type" text,
  "script_id" text,
  "template_id" text,
  "format_id" text,
  "face_profile_id" text,
  "hook_preview" text NOT NULL,
  "full_script" text NOT NULL,
  "video_url" text,
  "error" text,
  "progress" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
