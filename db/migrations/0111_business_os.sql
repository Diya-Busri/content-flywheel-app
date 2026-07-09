-- Phase 5: Business Operating System
-- Run this migration manually in Supabase SQL editor

-- Business goals: user-defined targets the orchestrator optimises toward
CREATE TABLE IF NOT EXISTS business_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  goal_type   TEXT NOT NULL,           -- revenue|products|content|followers|email_list|experiments|custom
  title       TEXT NOT NULL,
  target      REAL NOT NULL,
  current     REAL NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT '',
  deadline    TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS business_goals_user_idx ON business_goals(user_id);
CREATE INDEX IF NOT EXISTS business_goals_active_idx ON business_goals(user_id, is_active);

-- Orchestrator decisions: AI-generated prioritised next actions
CREATE TABLE IF NOT EXISTS orchestrator_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  reasoning       TEXT,
  priority        INTEGER NOT NULL DEFAULT 5,
  goal_alignment  TEXT,
  is_actioned     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orchestrator_decisions_user_idx     ON orchestrator_decisions(user_id);
CREATE INDEX IF NOT EXISTS orchestrator_decisions_created_idx  ON orchestrator_decisions(user_id, created_at DESC);
