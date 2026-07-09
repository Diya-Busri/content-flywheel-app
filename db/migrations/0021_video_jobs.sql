-- UGC Lab video jobs (batch generation, one per variation)
CREATE TABLE IF NOT EXISTS "video_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "batch_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "hook_preview" text NOT NULL,
  "full_script" text NOT NULL,
  "template_id" text,
  "face_profile_id" text,
  "video_url" text,
  "error" text,
  "progress" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
