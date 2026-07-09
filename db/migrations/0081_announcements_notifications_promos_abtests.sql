-- Announcements table
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text NOT NULL DEFAULT 'info',
  "active" boolean NOT NULL DEFAULT true,
  "target_all" boolean NOT NULL DEFAULT true,
  "link_url" text,
  "link_label" text,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text NOT NULL DEFAULT 'info',
  "read" boolean NOT NULL DEFAULT false,
  "link_url" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "description" text,
  "discount_percent" integer NOT NULL DEFAULT 0,
  "discount_amount" integer NOT NULL DEFAULT 0,
  "max_uses" integer,
  "used_count" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Promo code uses table
CREATE TABLE IF NOT EXISTS "promo_code_uses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_id" uuid NOT NULL REFERENCES "promo_codes"("id"),
  "user_id" text NOT NULL,
  "used_at" timestamp DEFAULT now() NOT NULL
);

-- A/B tests table
CREATE TABLE IF NOT EXISTS "ab_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "variants" jsonb NOT NULL DEFAULT '[]',
  "active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- A/B test assignments table
CREATE TABLE IF NOT EXISTS "ab_test_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "test_key" text NOT NULL,
  "user_id" text NOT NULL,
  "variant" text NOT NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL
);

-- Add suspended column to profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "suspend_reason" text;
