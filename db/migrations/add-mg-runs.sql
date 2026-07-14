-- Motion Graphics Agent Workflow Tables
-- Run this in the Supabase SQL Editor.
--
-- mg_runs  — one row per agent-workflow generation run
-- mg_steps — one row per tool execution attempt within a run
--
-- Design decisions:
--   • source_text lives on mg_runs only — never copied to step input/output
--   • mg_steps.attempt_number allows tracking retries without losing history
--   • UNIQUE on (run_id, tool_name, attempt_number) prevents duplicate logging
--   • No credit_key on mg_runs — idempotency is per-step via video_credit_transactions
--   • updated_at is maintained by a BEFORE UPDATE trigger (not application code)

-- ─── 1. mg_runs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mg_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,

  -- linked once saved successfully
  project_id      UUID,

  -- source material (source_text is the authoritative copy; never stored in steps)
  content_mode    TEXT        NOT NULL DEFAULT 'reddit-reaction',
  source_text     TEXT        NOT NULL DEFAULT '',
  source_url      TEXT,
  target_audience TEXT,
  main_opinion    TEXT,
  desired_cta     TEXT,
  cf_mention      TEXT        NOT NULL DEFAULT 'subtle',
  video_duration  TEXT,
  tone            TEXT,
  aspect_ratio    TEXT        NOT NULL DEFAULT '9:16',

  -- workflow state
  status          TEXT        NOT NULL DEFAULT 'queued'
                  CONSTRAINT mg_runs_status_check CHECK (status IN (
                    'queued',
                    'analysing',
                    'strategising',
                    'awaiting_plan_approval',
                    'scripting',
                    'storyboarding',
                    'awaiting_storyboard_approval',
                    'saving',
                    'completed',
                    'failed',
                    'cancelled'
                  )),

  current_gate    TEXT
                  CONSTRAINT mg_runs_gate_check CHECK (
                    current_gate IS NULL
                    OR current_gate IN ('plan_review', 'storyboard_review')
                  ),

  -- AI-generated output
  plan            JSONB,        -- MgPlan (source analyst + content strategist output)
  short_form      JSONB,        -- ShortFormOutput (approved storyboard)

  -- error message if status = 'failed'
  error           TEXT,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mg_runs_user_created
  ON mg_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mg_runs_status
  ON mg_runs (status);

CREATE INDEX IF NOT EXISTS idx_mg_runs_project_id
  ON mg_runs (project_id)
  WHERE project_id IS NOT NULL;

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION mg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mg_runs_updated_at ON mg_runs;
CREATE TRIGGER trg_mg_runs_updated_at
  BEFORE UPDATE ON mg_runs
  FOR EACH ROW EXECUTE FUNCTION mg_set_updated_at();

-- Optional FK to motion_graphics_projects (safe to skip if that table doesn't exist yet)
DO $$ BEGIN
  ALTER TABLE mg_runs
    ADD CONSTRAINT fk_mg_runs_project
    FOREIGN KEY (project_id)
    REFERENCES motion_graphics_projects(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table   THEN NULL;
END $$;

-- ─── 2. mg_steps ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mg_steps (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID         NOT NULL
                              REFERENCES mg_runs(id) ON DELETE CASCADE,

  tool_name      TEXT         NOT NULL,
  attempt_number INTEGER      NOT NULL DEFAULT 1
                              CONSTRAINT mg_steps_attempt_positive CHECK (attempt_number >= 1),

  status         TEXT         NOT NULL DEFAULT 'queued'
                              CONSTRAINT mg_steps_status_check CHECK (status IN (
                                'queued', 'running', 'completed', 'failed', 'skipped'
                              )),

  -- minimal diagnostic info only — does NOT store full source_text
  input          JSONB,
  output         JSONB,
  error          TEXT,

  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_mg_steps_attempt UNIQUE (run_id, tool_name, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_mg_steps_run_created
  ON mg_steps (run_id, created_at ASC);
