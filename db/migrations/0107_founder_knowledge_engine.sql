-- Founder OS — Knowledge Engine migration
-- Adds vector embeddings + richer metadata to founder_workspace_entries

-- Enable pgvector (Supabase has this available by default)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns
ALTER TABLE founder_workspace_entries
  ADD COLUMN IF NOT EXISTS embedding       vector(1536),
  ADD COLUMN IF NOT EXISTS tags            text[]                    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_summary      text,
  ADD COLUMN IF NOT EXISTS related_entry_ids text[]                  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS usage_count     integer                   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source          text                      DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence_score real                     DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS last_used_at    timestamp with time zone;

-- Approximate nearest-neighbour index for cosine similarity search.
-- lists = 100 is appropriate for up to ~1M rows; tune up if the table grows beyond that.
CREATE INDEX IF NOT EXISTS founder_workspace_embedding_idx
  ON founder_workspace_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index on tags array for fast tag filtering
CREATE INDEX IF NOT EXISTS founder_workspace_tags_idx
  ON founder_workspace_entries
  USING gin(tags);

-- Index on source for filtering by origin (manual | research | coach | analytics | experiment)
CREATE INDEX IF NOT EXISTS founder_workspace_source_idx
  ON founder_workspace_entries(source);
