-- Products table for digital product editor
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "niche" text NOT NULL,
  "format" text NOT NULL,
  "content" jsonb NOT NULL,
  "design_settings" jsonb,
  "placed_elements" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
