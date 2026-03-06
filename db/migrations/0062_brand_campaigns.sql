-- Brand campaigns: video/carousel content linked to a workspace.
CREATE TABLE IF NOT EXISTS brand_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES brand_workspaces(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  post_concept TEXT,
  script_json JSONB,
  voiceover_text TEXT,
  timeline_json JSONB,
  carousel_json JSONB,
  caption TEXT,
  hashtags TEXT,
  title TEXT,
  description TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_campaigns_user_id ON brand_campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_brand_campaigns_workspace_id ON brand_campaigns (workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_campaigns_status ON brand_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_brand_campaigns_created_at ON brand_campaigns (created_at DESC);

ALTER TABLE brand_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_campaigns_select_own" ON brand_campaigns;
CREATE POLICY "brand_campaigns_select_own" ON brand_campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_campaigns_insert_own" ON brand_campaigns;
CREATE POLICY "brand_campaigns_insert_own" ON brand_campaigns FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brand_campaigns_update_own" ON brand_campaigns;
CREATE POLICY "brand_campaigns_update_own" ON brand_campaigns FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "brand_campaigns_delete_own" ON brand_campaigns;
CREATE POLICY "brand_campaigns_delete_own" ON brand_campaigns FOR DELETE USING (true);
