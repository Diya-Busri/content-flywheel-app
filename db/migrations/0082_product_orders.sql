CREATE TABLE IF NOT EXISTS "product_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "creator_user_id" text NOT NULL,
  "buyer_email" text NOT NULL,
  "buyer_name" text,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'gbp',
  "stripe_session_id" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "download_token" text,
  "download_expires_at" timestamp,
  "email_sent" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);
