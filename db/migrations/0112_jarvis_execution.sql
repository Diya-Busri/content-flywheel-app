-- Jarvis Phase 1: AI execution assistant orchestration tables.
-- Run this migration manually via `npm run db:jarvis` (see scripts/run-jarvis-migration.mjs).
--
-- execution_runs: one row per user goal ("Content Flywheel needs more sales...").
-- execution_steps: one row per internal tool call within a run, used to render
-- the live execution panel and to recover state after a page refresh.
--
-- Statuses (execution_runs.status):
--   queued | planning | running | awaiting_approval | completed | failed | cancelled
-- current_gate distinguishes WHICH approval screen "awaiting_approval" refers to:
--   'plan_review' (strategy needs approval before generating assets)
--   'asset_review' (generated assets need approval before saving)
--   NULL once the run is completed/failed/cancelled or still actively running.
--
-- Statuses (execution_steps.status):
--   queued | running | completed | failed | skipped

CREATE TABLE IF NOT EXISTS execution_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  goal           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'queued',
  current_gate   TEXT,
  plan           JSONB,
  assets         JSONB NOT NULL DEFAULT '[]',
  final_summary  JSONB,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_runs_user_idx         ON execution_runs(user_id);
CREATE INDEX IF NOT EXISTS execution_runs_user_created_idx ON execution_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS execution_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  tool_name     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',
  input         JSONB,
  output        JSONB,
  error         TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_steps_run_idx         ON execution_steps(run_id);
CREATE INDEX IF NOT EXISTS execution_steps_run_created_idx ON execution_steps(run_id, created_at);
