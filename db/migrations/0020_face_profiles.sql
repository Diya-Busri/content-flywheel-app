-- Face profiles for UGC Lab (reusable across projects)
CREATE TABLE IF NOT EXISTS "face_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "image_url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
