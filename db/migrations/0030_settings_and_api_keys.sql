-- User settings and API keys (1:1 with profiles via user_id)
CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" text PRIMARY KEY REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "display_name" text,
  "openai_api_key" text,
  "shotstack_api_key" text,
  "default_product_type" text NOT NULL DEFAULT 'digital_product',
  "default_video_style" text NOT NULL DEFAULT 'professional',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
