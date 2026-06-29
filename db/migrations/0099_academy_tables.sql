CREATE TABLE IF NOT EXISTS "academy_courses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text,
  "thumbnail_url" text,
  "difficulty" text DEFAULT 'beginner',
  "estimated_duration" text,
  "is_published" boolean NOT NULL DEFAULT false,
  "order_index" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academy_modules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "course_id" uuid NOT NULL REFERENCES "academy_courses"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "order_index" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academy_lessons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL REFERENCES "academy_modules"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "academy_courses"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text,
  "video_url" text,
  "lesson_type" text DEFAULT 'video',
  "order_index" integer NOT NULL DEFAULT 0,
  "is_published" boolean NOT NULL DEFAULT true,
  "duration_minutes" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academy_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lesson_id" uuid NOT NULL REFERENCES "academy_lessons"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "file_type" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academy_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "lesson_id" uuid NOT NULL REFERENCES "academy_lessons"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "academy_courses"("id") ON DELETE CASCADE,
  "completed_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("user_id", "lesson_id")
);

CREATE TABLE IF NOT EXISTS "academy_community_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "user_email" text,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "image_urls" text,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "is_featured" boolean NOT NULL DEFAULT false,
  "likes_count" integer NOT NULL DEFAULT 0,
  "comments_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academy_community_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL REFERENCES "academy_community_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "user_email" text,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academy_community_likes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL REFERENCES "academy_community_posts"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("post_id", "user_id")
);
