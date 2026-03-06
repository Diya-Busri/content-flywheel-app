-- Fix RLS policies: replace permissive (USING (true)) with user_id = auth.uid()::text.
-- These tables had RLS enabled but policies allowed all rows; now restrict to owning user.
-- Run after 0061–0063, 0057–0060. Safe to run multiple times (DROP IF EXISTS then CREATE).

-- 1. brand_workspaces
ALTER TABLE brand_workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_workspaces_select_own" ON brand_workspaces;
DROP POLICY IF EXISTS "brand_workspaces_insert_own" ON brand_workspaces;
DROP POLICY IF EXISTS "brand_workspaces_update_own" ON brand_workspaces;
DROP POLICY IF EXISTS "brand_workspaces_delete_own" ON brand_workspaces;
CREATE POLICY "brand_workspaces_select_own" ON brand_workspaces FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "brand_workspaces_insert_own" ON brand_workspaces FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "brand_workspaces_update_own" ON brand_workspaces FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "brand_workspaces_delete_own" ON brand_workspaces FOR DELETE USING (user_id = auth.uid()::text);

-- 2. brand_campaigns
ALTER TABLE brand_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_campaigns_select_own" ON brand_campaigns;
DROP POLICY IF EXISTS "brand_campaigns_insert_own" ON brand_campaigns;
DROP POLICY IF EXISTS "brand_campaigns_update_own" ON brand_campaigns;
DROP POLICY IF EXISTS "brand_campaigns_delete_own" ON brand_campaigns;
CREATE POLICY "brand_campaigns_select_own" ON brand_campaigns FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "brand_campaigns_insert_own" ON brand_campaigns FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "brand_campaigns_update_own" ON brand_campaigns FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "brand_campaigns_delete_own" ON brand_campaigns FOR DELETE USING (user_id = auth.uid()::text);

-- 3. template_packs
ALTER TABLE template_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "template_packs_select_own" ON template_packs;
DROP POLICY IF EXISTS "template_packs_insert_own" ON template_packs;
DROP POLICY IF EXISTS "template_packs_update_own" ON template_packs;
DROP POLICY IF EXISTS "template_packs_delete_own" ON template_packs;
CREATE POLICY "template_packs_select_own" ON template_packs FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "template_packs_insert_own" ON template_packs FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "template_packs_update_own" ON template_packs FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "template_packs_delete_own" ON template_packs FOR DELETE USING (user_id = auth.uid()::text);

-- 4. brand_calendar
ALTER TABLE brand_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand_calendar_select_own" ON brand_calendar;
DROP POLICY IF EXISTS "brand_calendar_insert_own" ON brand_calendar;
DROP POLICY IF EXISTS "brand_calendar_update_own" ON brand_calendar;
DROP POLICY IF EXISTS "brand_calendar_delete_own" ON brand_calendar;
CREATE POLICY "brand_calendar_select_own" ON brand_calendar FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "brand_calendar_insert_own" ON brand_calendar FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "brand_calendar_update_own" ON brand_calendar FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "brand_calendar_delete_own" ON brand_calendar FOR DELETE USING (user_id = auth.uid()::text);

-- 5. drop_scripts
ALTER TABLE drop_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drop_scripts_select_own" ON drop_scripts;
DROP POLICY IF EXISTS "drop_scripts_insert_own" ON drop_scripts;
DROP POLICY IF EXISTS "drop_scripts_update_own" ON drop_scripts;
DROP POLICY IF EXISTS "drop_scripts_delete_own" ON drop_scripts;
CREATE POLICY "drop_scripts_select_own" ON drop_scripts FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "drop_scripts_insert_own" ON drop_scripts FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "drop_scripts_update_own" ON drop_scripts FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "drop_scripts_delete_own" ON drop_scripts FOR DELETE USING (user_id = auth.uid()::text);

-- 6. launch_checklist
ALTER TABLE launch_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "launch_checklist_select_own" ON launch_checklist;
DROP POLICY IF EXISTS "launch_checklist_insert_own" ON launch_checklist;
DROP POLICY IF EXISTS "launch_checklist_update_own" ON launch_checklist;
DROP POLICY IF EXISTS "launch_checklist_delete_own" ON launch_checklist;
CREATE POLICY "launch_checklist_select_own" ON launch_checklist FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "launch_checklist_insert_own" ON launch_checklist FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "launch_checklist_update_own" ON launch_checklist FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "launch_checklist_delete_own" ON launch_checklist FOR DELETE USING (user_id = auth.uid()::text);

-- 7. scheduled_posts
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_posts_select_own" ON scheduled_posts;
DROP POLICY IF EXISTS "scheduled_posts_insert_own" ON scheduled_posts;
DROP POLICY IF EXISTS "scheduled_posts_update_own" ON scheduled_posts;
DROP POLICY IF EXISTS "scheduled_posts_delete_own" ON scheduled_posts;
CREATE POLICY "scheduled_posts_select_own" ON scheduled_posts FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "scheduled_posts_insert_own" ON scheduled_posts FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "scheduled_posts_update_own" ON scheduled_posts FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "scheduled_posts_delete_own" ON scheduled_posts FOR DELETE USING (user_id = auth.uid()::text);
