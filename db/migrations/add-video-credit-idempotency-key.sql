-- Migration: Add idempotency_key to video_credit_transactions
-- Run in Supabase SQL Editor
--
-- Prevents duplicate video credit grants caused by webhook retries or race conditions.
-- Format: "clerk:signup:{userId}" | "stripe:invoice:{invoiceId}" | "stripe:session:{sessionId}"
-- The partial unique index allows multiple NULLs (legacy/manual rows) while enforcing
-- uniqueness for any explicitly keyed grant.

ALTER TABLE video_credit_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_vct_idempotency_key
  ON video_credit_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
