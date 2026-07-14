-- Tracks whether we've already auto-tagged a "needed extra help" note into the
-- user's Business Brain for this checkpoint, so confirming understanding more
-- than once (e.g. a retried request) never creates duplicate memory entries.
-- Run manually via `npm run db:academy-checkpoint-struggle-memory`.
-- Idempotent (IF NOT EXISTS) — safe to re-run.

ALTER TABLE academy_lesson_checkpoints ADD COLUMN IF NOT EXISTS struggle_memory_saved_at TIMESTAMPTZ;
