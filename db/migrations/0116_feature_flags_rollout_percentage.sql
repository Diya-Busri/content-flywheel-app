-- Optional gradual (percentage) rollout for global feature flags — lets a
-- flag target e.g. 10% of users deterministically instead of only ever being
-- fully on or fully off (or manually creating one per-user row per user).
-- Run manually via `npm run db:feature-flags-rollout`.
-- Idempotent (IF NOT EXISTS) — safe to re-run.

ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS rollout_percentage INTEGER;
