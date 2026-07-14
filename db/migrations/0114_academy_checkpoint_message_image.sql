-- Persist opt-in "Add a visual" images against the checkpoint message they belong to,
-- so a generated diagram survives closing/reopening the Understanding Check panel
-- instead of being lost as client-only state.
-- Run manually via `npm run db:academy-checkpoint-message-image`.
-- Idempotent (IF NOT EXISTS) — safe to re-run.

ALTER TABLE academy_checkpoint_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
