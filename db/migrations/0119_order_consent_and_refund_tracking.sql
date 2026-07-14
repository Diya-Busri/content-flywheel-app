-- Digital product refund policy overhaul: replace the old blanket 30-day
-- money-back guarantee with a statutory-rights-based policy, capture the
-- buyer's pre-payment consent on every order, track when access/first
-- download happen, and support seller/admin refund + access revocation.
--
-- Run via `node scripts/run-order-consent-migration.mjs`, or paste directly
-- into the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS guards).

ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS buyer_user_id TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS consent_text TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS consent_policy_version TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMP;

ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMP;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS first_download_at TIMESTAMP;

ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS refunded_by TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP;
