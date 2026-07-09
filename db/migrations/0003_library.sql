-- Add status to products if not exists (some setups may have it)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;

-- Scripts table for saved/compliant scripts
CREATE TABLE IF NOT EXISTS "scripts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "platform" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "video_id" text,
  "product_id" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Videos table for TikTok Shop and other videos
CREATE TABLE IF NOT EXISTS "videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "thumbnail_url" text,
  "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "product_id" text,
  "script_id" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
