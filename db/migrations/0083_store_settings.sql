CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "theme" text NOT NULL DEFAULT 'warm',
  "accent_color" text NOT NULL DEFAULT '#f97316',
  "layout" text NOT NULL DEFAULT 'grid',
  "banner_image_url" text,
  "banner_gradient" text,
  "profile_image_url" text,
  "bio" text,
  "show_social_links" boolean DEFAULT false,
  "social_links" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
