-- TikTok Shop generated videos
CREATE TABLE IF NOT EXISTS "tiktok_shop_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "product_link" text NOT NULL,
  "video_url" text NOT NULL,
  "video_style" text NOT NULL,
  "platform" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
