-- Personal AI Memory — per-user knowledge base
-- Run in Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_memory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  category            TEXT NOT NULL,
  type                TEXT NOT NULL,
  title               TEXT NOT NULL,
  content             TEXT NOT NULL DEFAULT '',
  metadata            JSONB,
  embedding           vector(1536),
  ai_summary          TEXT,
  tags                TEXT[] DEFAULT '{}',
  memory_type         TEXT NOT NULL DEFAULT 'automatic',
  source              TEXT NOT NULL DEFAULT 'manual',
  confidence_score    REAL DEFAULT 1.0 NOT NULL,
  usage_count         INTEGER DEFAULT 0 NOT NULL,
  related_memory_ids  TEXT[] DEFAULT '{}',
  last_used_at        TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Core lookup indexes
CREATE INDEX IF NOT EXISTS user_memory_user_id_idx
  ON user_memory(user_id);

CREATE INDEX IF NOT EXISTS user_memory_category_idx
  ON user_memory(user_id, category);

CREATE INDEX IF NOT EXISTS user_memory_type_idx
  ON user_memory(user_id, memory_type);

CREATE INDEX IF NOT EXISTS user_memory_source_idx
  ON user_memory(user_id, source);

-- Semantic vector search
CREATE INDEX IF NOT EXISTS user_memory_embedding_idx
  ON user_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Tag search
CREATE INDEX IF NOT EXISTS user_memory_tags_idx
  ON user_memory USING gin(tags);

-- Usage + recency sorting
CREATE INDEX IF NOT EXISTS user_memory_usage_idx
  ON user_memory(user_id, usage_count DESC);
