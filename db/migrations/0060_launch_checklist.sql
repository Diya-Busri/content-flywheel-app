-- Brand Builder Launch Checklist: one row per user, roadmap + completed_tasks.
CREATE TABLE IF NOT EXISTS launch_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  brand_name TEXT,
  follower_count TEXT,
  pod_platform TEXT,
  selling_platform TEXT,
  stage TEXT,
  milestone_to_launch TEXT,
  checklist JSONB,
  completed_tasks JSONB,
  waitlist_email JSONB,
  first_drop_pricing JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launch_checklist_user_id ON launch_checklist (user_id);

ALTER TABLE launch_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "launch_checklist_select_own" ON launch_checklist;
CREATE POLICY "launch_checklist_select_own" ON launch_checklist FOR SELECT USING (true);

DROP POLICY IF EXISTS "launch_checklist_insert_own" ON launch_checklist;
CREATE POLICY "launch_checklist_insert_own" ON launch_checklist FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "launch_checklist_update_own" ON launch_checklist;
CREATE POLICY "launch_checklist_update_own" ON launch_checklist FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "launch_checklist_delete_own" ON launch_checklist;
CREATE POLICY "launch_checklist_delete_own" ON launch_checklist FOR DELETE USING (true);
