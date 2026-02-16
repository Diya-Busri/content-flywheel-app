-- UGC Lab: All required tables (idempotent)
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f db/migrations/0025_ugc_lab_all_tables.sql

-- 1. Face profiles (reusable across projects)
CREATE TABLE IF NOT EXISTS "face_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "image_url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 2. UGC campaigns (multi-product)
CREATE TABLE IF NOT EXISTS "ugc_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "project_type" text NOT NULL,
  "campaign_name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 3. Campaign products (1-5 per campaign)
CREATE TABLE IF NOT EXISTS "ugc_campaign_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "ugc_campaigns"("id") ON DELETE CASCADE,
  "product_name" text NOT NULL,
  "product_link" text,
  "role" text DEFAULT 'primary' NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL
);

-- 4. Video jobs (one per script variation)
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

-- Add columns if created from older migration (0021) that lacked them
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "campaign_id" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "external_job_id" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "parent_job_id" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "angle_type" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "script_id" text;
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "format_id" text;
