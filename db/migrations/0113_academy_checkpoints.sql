-- Academy "Understanding Check" — end-of-lesson checkpoint.
-- Run manually via `npm run db:academy-checkpoints` (see scripts/run-academy-checkpoint-migration.mjs).
--
-- academy_lesson_checkpoints: one row per (user, lesson). Tracks checkpoint UI
--   state and understanding_confirmed SEPARATELY from academy_progress (lesson
--   completion) so a user can complete a lesson without being forced to
--   confirm understanding, and vice versa.
-- academy_checkpoint_messages: conversation transcript for a checkpoint.
--   Quick-action clicks are stored as a synthetic user message so history
--   reads as one natural thread on reopen. `seq` gives deterministic
--   ordering even when created_at collides at millisecond resolution.
--
-- All statements are idempotent (IF NOT EXISTS) — safe to re-run.

-- Optional lesson metadata (all nullable — fully backwards compatible).
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS learning_objectives TEXT;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS key_concepts TEXT;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS suggested_exercise TEXT;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS apply_tool_key TEXT;

CREATE TABLE IF NOT EXISTS academy_lesson_checkpoints (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       TEXT NOT NULL,
  lesson_id                     UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  course_id                     UUID NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
  status                        TEXT NOT NULL DEFAULT 'not_opened',
  understanding_confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  understanding_confirmed_at    TIMESTAMPTZ,
  last_help_option              TEXT,
  skipped_at                    TIMESTAMPTZ,
  application_output            JSONB,
  application_output_saved_at   TIMESTAMPTZ,
  opened_at                     TIMESTAMPTZ,
  last_interaction_at           TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforces "reopening a checkpoint does not create duplicate rows" — callers
-- upsert on (user_id, lesson_id).
CREATE UNIQUE INDEX IF NOT EXISTS academy_lesson_checkpoints_user_lesson_unique
  ON academy_lesson_checkpoints (user_id, lesson_id);
CREATE INDEX IF NOT EXISTS academy_lesson_checkpoints_lesson_idx ON academy_lesson_checkpoints (lesson_id);
CREATE INDEX IF NOT EXISTS academy_lesson_checkpoints_user_idx ON academy_lesson_checkpoints (user_id);

CREATE TABLE IF NOT EXISTS academy_checkpoint_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id  UUID NOT NULL REFERENCES academy_lesson_checkpoints(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  content        TEXT NOT NULL,
  help_option    TEXT,
  seq            INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academy_checkpoint_messages_checkpoint_idx ON academy_checkpoint_messages (checkpoint_id);
-- Deterministic chronological order for a checkpoint's transcript.
CREATE INDEX IF NOT EXISTS academy_checkpoint_messages_checkpoint_seq_idx ON academy_checkpoint_messages (checkpoint_id, seq);
