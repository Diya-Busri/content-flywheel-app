-- Phase 4: AI Agent System
-- Run this migration manually in Supabase SQL editor

-- Agent preferences: per-user, per-agent enable/disable
CREATE TABLE IF NOT EXISTS agent_preferences (
  user_id    TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, agent_type)
);

-- Agent runs log
CREATE TABLE IF NOT EXISTS agent_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  agent_type        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'running',
  discoveries_count INTEGER NOT NULL DEFAULT 0,
  tasks_count       INTEGER NOT NULL DEFAULT 0,
  reasoning_log     JSONB NOT NULL DEFAULT '[]',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_runs_user_idx     ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS agent_runs_started_idx  ON agent_runs(user_id, started_at DESC);

-- Agent discoveries: opportunities, insights, warnings surfaced by agents
CREATE TABLE IF NOT EXISTS agent_discoveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  agent_type     TEXT NOT NULL,
  discovery_type TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  confidence     REAL NOT NULL DEFAULT 0.7,
  priority       INTEGER NOT NULL DEFAULT 5,
  is_dismissed   BOOLEAN NOT NULL DEFAULT FALSE,
  action_type    TEXT,
  action_label   TEXT,
  action_url     TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_discoveries_user_idx     ON agent_discoveries(user_id);
CREATE INDEX IF NOT EXISTS agent_discoveries_created_idx  ON agent_discoveries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_discoveries_active_idx   ON agent_discoveries(user_id, is_dismissed, created_at DESC);

-- Agent tasks: recommended actions for users
CREATE TABLE IF NOT EXISTS agent_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  agent_type   TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  priority     INTEGER NOT NULL DEFAULT 5,
  due_date     TIMESTAMPTZ,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_tasks_user_idx   ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS agent_tasks_status_idx ON agent_tasks(user_id, status);
