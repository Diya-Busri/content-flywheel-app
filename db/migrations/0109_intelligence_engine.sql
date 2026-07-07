-- AI Intelligence Engine — Phase 3
-- Run in Supabase SQL editor

-- ── Scoring columns on user_memory ───────────────────────────────────────────
ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS importance_score   REAL DEFAULT 0.5 NOT NULL,
  ADD COLUMN IF NOT EXISTS performance_score  REAL DEFAULT 0.5 NOT NULL,
  ADD COLUMN IF NOT EXISTS combined_score     REAL DEFAULT 0.5 NOT NULL,
  ADD COLUMN IF NOT EXISTS related_memory_ids TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS user_memory_combined_score_idx
  ON user_memory(user_id, combined_score DESC);

-- ── Detected patterns ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_patterns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  pattern_type        TEXT NOT NULL,       -- content|product|design|analytics|behavior|pricing
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  evidence_ids        TEXT[] DEFAULT '{}', -- memory IDs that support this
  confidence          REAL DEFAULT 0.5 NOT NULL,
  occurrences         INTEGER DEFAULT 1 NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE NOT NULL,
  metadata            JSONB,
  first_detected_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_confirmed_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_patterns_user_id_idx ON user_patterns(user_id);
CREATE INDEX IF NOT EXISTS user_patterns_active_idx  ON user_patterns(user_id, is_active, confidence DESC);

-- ── Proactive recommendations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  rec_type            TEXT NOT NULL,       -- action|insight|opportunity|warning
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  confidence          REAL DEFAULT 0.7 NOT NULL,
  priority            INTEGER DEFAULT 5 NOT NULL,  -- 1–10
  action_type         TEXT,               -- create-product|run-research|create-experiment|null
  related_memory_ids  TEXT[] DEFAULT '{}',
  related_pattern_ids TEXT[] DEFAULT '{}',
  is_dismissed        BOOLEAN DEFAULT FALSE NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_recommendations_user_id_idx
  ON user_recommendations(user_id, is_dismissed, priority DESC);

-- ── Intelligence timeline ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_intelligence_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,     -- memory_saved|memory_merged|pattern_detected|recommendation_generated|score_updated
  title       TEXT NOT NULL,
  description TEXT,
  memory_id   UUID,
  pattern_id  UUID,
  metadata    JSONB,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS user_intelligence_timeline_user_id_idx
  ON user_intelligence_timeline(user_id, created_at DESC);
