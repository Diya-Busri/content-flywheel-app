-- Brand workspaces for Campaign Mode (clothing/digital/both, optional password).
CREATE TABLE IF NOT EXISTS brand_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_type TEXT NOT NULL,
  aesthetic_vibe TEXT,
  niche TEXT,
  target_audience TEXT,
  platform TEXT,
  colour_primary TEXT,
  colour_secondary TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_workspaces_user_id ON brand_workspaces (user_id);
CREATE INDEX IF NOT EXISTS idx_brand_workspaces_created_at ON brand_workspaces (created_at DESC);

ALTER TABLE brand_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_workspaces_select_own" ON brand_workspaces;
CREATE POLICY "brand_workspaces_select_own" ON brand_workspaces FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_workspaces_insert_own" ON brand_workspaces;
CREATE POLICY "brand_workspaces_insert_own" ON brand_workspaces FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brand_workspaces_update_own" ON brand_workspaces;
CREATE POLICY "brand_workspaces_update_own" ON brand_workspaces FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "brand_workspaces_delete_own" ON brand_workspaces;
CREATE POLICY "brand_workspaces_delete_own" ON brand_workspaces FOR DELETE USING (true);
