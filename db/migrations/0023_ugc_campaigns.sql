-- UGC Lab multi-product campaigns
CREATE TABLE IF NOT EXISTS "ugc_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "project_type" text NOT NULL,
  "campaign_name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ugc_campaign_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "ugc_campaigns"("id") ON DELETE CASCADE,
  "product_name" text NOT NULL,
  "product_link" text,
  "role" text DEFAULT 'primary' NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL
);

-- Add campaign_id to video_jobs
ALTER TABLE "video_jobs" ADD COLUMN IF NOT EXISTS "campaign_id" text;
