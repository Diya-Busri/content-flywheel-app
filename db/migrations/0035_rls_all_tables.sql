-- Row Level Security (RLS) for all user-scoped tables.
-- Each policy filters by auth.uid()::text matching the table's user_id column
-- (or, for child tables, the parent's user_id via EXISTS).
-- Run this in Supabase SQL Editor or via your migration runner.
--
-- Tables skipped (no user_id or different model): niche_cache, pending_profiles,
-- feedback, review_prompts, reviews.

-- ============== Tables with user_id column ==============

-- products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_products_select" ON "products";
DROP POLICY IF EXISTS "rls_products_insert" ON "products";
DROP POLICY IF EXISTS "rls_products_update" ON "products";
DROP POLICY IF EXISTS "rls_products_delete" ON "products";
CREATE POLICY "rls_products_select" ON "products" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_products_insert" ON "products" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_products_update" ON "products" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_products_delete" ON "products" FOR DELETE USING (user_id = auth.uid()::text);

-- scripts
ALTER TABLE "scripts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_scripts_select" ON "scripts";
DROP POLICY IF EXISTS "rls_scripts_insert" ON "scripts";
DROP POLICY IF EXISTS "rls_scripts_update" ON "scripts";
DROP POLICY IF EXISTS "rls_scripts_delete" ON "scripts";
CREATE POLICY "rls_scripts_select" ON "scripts" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_scripts_insert" ON "scripts" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_scripts_update" ON "scripts" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_scripts_delete" ON "scripts" FOR DELETE USING (user_id = auth.uid()::text);

-- videos
ALTER TABLE "videos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_videos_select" ON "videos";
DROP POLICY IF EXISTS "rls_videos_insert" ON "videos";
DROP POLICY IF EXISTS "rls_videos_update" ON "videos";
DROP POLICY IF EXISTS "rls_videos_delete" ON "videos";
CREATE POLICY "rls_videos_select" ON "videos" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_videos_insert" ON "videos" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_videos_update" ON "videos" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_videos_delete" ON "videos" FOR DELETE USING (user_id = auth.uid()::text);

-- goals (re-enable RLS; 0016 had disabled it for Clerk)
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_goals_select" ON "goals";
DROP POLICY IF EXISTS "rls_goals_insert" ON "goals";
DROP POLICY IF EXISTS "rls_goals_update" ON "goals";
DROP POLICY IF EXISTS "rls_goals_delete" ON "goals";
CREATE POLICY "rls_goals_select" ON "goals" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_goals_insert" ON "goals" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_goals_update" ON "goals" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_goals_delete" ON "goals" FOR DELETE USING (user_id = auth.uid()::text);

-- goal_reminder_settings
ALTER TABLE "goal_reminder_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_goal_reminder_settings_select" ON "goal_reminder_settings";
DROP POLICY IF EXISTS "rls_goal_reminder_settings_insert" ON "goal_reminder_settings";
DROP POLICY IF EXISTS "rls_goal_reminder_settings_update" ON "goal_reminder_settings";
DROP POLICY IF EXISTS "rls_goal_reminder_settings_delete" ON "goal_reminder_settings";
CREATE POLICY "rls_goal_reminder_settings_select" ON "goal_reminder_settings" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_goal_reminder_settings_insert" ON "goal_reminder_settings" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_goal_reminder_settings_update" ON "goal_reminder_settings" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_goal_reminder_settings_delete" ON "goal_reminder_settings" FOR DELETE USING (user_id = auth.uid()::text);

-- user_settings
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_user_settings_select" ON "user_settings";
DROP POLICY IF EXISTS "rls_user_settings_insert" ON "user_settings";
DROP POLICY IF EXISTS "rls_user_settings_update" ON "user_settings";
DROP POLICY IF EXISTS "rls_user_settings_delete" ON "user_settings";
CREATE POLICY "rls_user_settings_select" ON "user_settings" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_user_settings_insert" ON "user_settings" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_user_settings_update" ON "user_settings" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_user_settings_delete" ON "user_settings" FOR DELETE USING (user_id = auth.uid()::text);

-- face_profiles
ALTER TABLE "face_profiles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_face_profiles_select" ON "face_profiles";
DROP POLICY IF EXISTS "rls_face_profiles_insert" ON "face_profiles";
DROP POLICY IF EXISTS "rls_face_profiles_update" ON "face_profiles";
DROP POLICY IF EXISTS "rls_face_profiles_delete" ON "face_profiles";
CREATE POLICY "rls_face_profiles_select" ON "face_profiles" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_face_profiles_insert" ON "face_profiles" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_face_profiles_update" ON "face_profiles" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_face_profiles_delete" ON "face_profiles" FOR DELETE USING (user_id = auth.uid()::text);

-- ugc_campaigns
ALTER TABLE "ugc_campaigns" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_ugc_campaigns_select" ON "ugc_campaigns";
DROP POLICY IF EXISTS "rls_ugc_campaigns_insert" ON "ugc_campaigns";
DROP POLICY IF EXISTS "rls_ugc_campaigns_update" ON "ugc_campaigns";
DROP POLICY IF EXISTS "rls_ugc_campaigns_delete" ON "ugc_campaigns";
CREATE POLICY "rls_ugc_campaigns_select" ON "ugc_campaigns" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_ugc_campaigns_insert" ON "ugc_campaigns" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_ugc_campaigns_update" ON "ugc_campaigns" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_ugc_campaigns_delete" ON "ugc_campaigns" FOR DELETE USING (user_id = auth.uid()::text);

-- video_jobs
ALTER TABLE "video_jobs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_video_jobs_select" ON "video_jobs";
DROP POLICY IF EXISTS "rls_video_jobs_insert" ON "video_jobs";
DROP POLICY IF EXISTS "rls_video_jobs_update" ON "video_jobs";
DROP POLICY IF EXISTS "rls_video_jobs_delete" ON "video_jobs";
CREATE POLICY "rls_video_jobs_select" ON "video_jobs" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_video_jobs_insert" ON "video_jobs" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_video_jobs_update" ON "video_jobs" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_video_jobs_delete" ON "video_jobs" FOR DELETE USING (user_id = auth.uid()::text);

-- tiktok_shop_videos
ALTER TABLE "tiktok_shop_videos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_tiktok_shop_videos_select" ON "tiktok_shop_videos";
DROP POLICY IF EXISTS "rls_tiktok_shop_videos_insert" ON "tiktok_shop_videos";
DROP POLICY IF EXISTS "rls_tiktok_shop_videos_update" ON "tiktok_shop_videos";
DROP POLICY IF EXISTS "rls_tiktok_shop_videos_delete" ON "tiktok_shop_videos";
CREATE POLICY "rls_tiktok_shop_videos_select" ON "tiktok_shop_videos" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_tiktok_shop_videos_insert" ON "tiktok_shop_videos" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_tiktok_shop_videos_update" ON "tiktok_shop_videos" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_tiktok_shop_videos_delete" ON "tiktok_shop_videos" FOR DELETE USING (user_id = auth.uid()::text);

-- render_jobs (replace any existing policies with consistent naming)
ALTER TABLE "render_jobs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own render jobs" ON "render_jobs";
DROP POLICY IF EXISTS "Users can insert own render jobs" ON "render_jobs";
DROP POLICY IF EXISTS "Users can update own render jobs" ON "render_jobs";
DROP POLICY IF EXISTS "rls_render_jobs_select" ON "render_jobs";
DROP POLICY IF EXISTS "rls_render_jobs_insert" ON "render_jobs";
DROP POLICY IF EXISTS "rls_render_jobs_update" ON "render_jobs";
DROP POLICY IF EXISTS "rls_render_jobs_delete" ON "render_jobs";
CREATE POLICY "rls_render_jobs_select" ON "render_jobs" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_render_jobs_insert" ON "render_jobs" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_render_jobs_update" ON "render_jobs" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_render_jobs_delete" ON "render_jobs" FOR DELETE USING (user_id = auth.uid()::text);

-- profiles
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_profiles_select" ON "profiles";
DROP POLICY IF EXISTS "rls_profiles_insert" ON "profiles";
DROP POLICY IF EXISTS "rls_profiles_update" ON "profiles";
DROP POLICY IF EXISTS "rls_profiles_delete" ON "profiles";
CREATE POLICY "rls_profiles_select" ON "profiles" FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "rls_profiles_insert" ON "profiles" FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "rls_profiles_update" ON "profiles" FOR UPDATE USING (user_id = auth.uid()::text);
CREATE POLICY "rls_profiles_delete" ON "profiles" FOR DELETE USING (user_id = auth.uid()::text);

-- ============== Child tables (access via parent user_id) ==============

-- daily_tasks: allow access if the parent goal belongs to the user
ALTER TABLE "daily_tasks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_daily_tasks_select" ON "daily_tasks";
DROP POLICY IF EXISTS "rls_daily_tasks_insert" ON "daily_tasks";
DROP POLICY IF EXISTS "rls_daily_tasks_update" ON "daily_tasks";
DROP POLICY IF EXISTS "rls_daily_tasks_delete" ON "daily_tasks";
CREATE POLICY "rls_daily_tasks_select" ON "daily_tasks" FOR SELECT USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = daily_tasks.goal_id AND g.user_id = auth.uid()::text)
);
CREATE POLICY "rls_daily_tasks_insert" ON "daily_tasks" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = daily_tasks.goal_id AND g.user_id = auth.uid()::text)
);
CREATE POLICY "rls_daily_tasks_update" ON "daily_tasks" FOR UPDATE USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = daily_tasks.goal_id AND g.user_id = auth.uid()::text)
);
CREATE POLICY "rls_daily_tasks_delete" ON "daily_tasks" FOR DELETE USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = daily_tasks.goal_id AND g.user_id = auth.uid()::text)
);

-- goal_weekly_reviews: allow access if the parent goal belongs to the user
ALTER TABLE "goal_weekly_reviews" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_goal_weekly_reviews_select" ON "goal_weekly_reviews";
DROP POLICY IF EXISTS "rls_goal_weekly_reviews_insert" ON "goal_weekly_reviews";
DROP POLICY IF EXISTS "rls_goal_weekly_reviews_update" ON "goal_weekly_reviews";
DROP POLICY IF EXISTS "rls_goal_weekly_reviews_delete" ON "goal_weekly_reviews";
CREATE POLICY "rls_goal_weekly_reviews_select" ON "goal_weekly_reviews" FOR SELECT USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_weekly_reviews.goal_id AND g.user_id = auth.uid()::text)
);
CREATE POLICY "rls_goal_weekly_reviews_insert" ON "goal_weekly_reviews" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_weekly_reviews.goal_id AND g.user_id = auth.uid()::text)
);
CREATE POLICY "rls_goal_weekly_reviews_update" ON "goal_weekly_reviews" FOR UPDATE USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_weekly_reviews.goal_id AND g.user_id = auth.uid()::text)
);
CREATE POLICY "rls_goal_weekly_reviews_delete" ON "goal_weekly_reviews" FOR DELETE USING (
  EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_weekly_reviews.goal_id AND g.user_id = auth.uid()::text)
);

-- ugc_campaign_products: allow access if the parent campaign belongs to the user
ALTER TABLE "ugc_campaign_products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rls_ugc_campaign_products_select" ON "ugc_campaign_products";
DROP POLICY IF EXISTS "rls_ugc_campaign_products_insert" ON "ugc_campaign_products";
DROP POLICY IF EXISTS "rls_ugc_campaign_products_update" ON "ugc_campaign_products";
DROP POLICY IF EXISTS "rls_ugc_campaign_products_delete" ON "ugc_campaign_products";
CREATE POLICY "rls_ugc_campaign_products_select" ON "ugc_campaign_products" FOR SELECT USING (
  EXISTS (SELECT 1 FROM ugc_campaigns c WHERE c.id = ugc_campaign_products.campaign_id AND c.user_id = auth.uid()::text)
);
CREATE POLICY "rls_ugc_campaign_products_insert" ON "ugc_campaign_products" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM ugc_campaigns c WHERE c.id = ugc_campaign_products.campaign_id AND c.user_id = auth.uid()::text)
);
CREATE POLICY "rls_ugc_campaign_products_update" ON "ugc_campaign_products" FOR UPDATE USING (
  EXISTS (SELECT 1 FROM ugc_campaigns c WHERE c.id = ugc_campaign_products.campaign_id AND c.user_id = auth.uid()::text)
);
CREATE POLICY "rls_ugc_campaign_products_delete" ON "ugc_campaign_products" FOR DELETE USING (
  EXISTS (SELECT 1 FROM ugc_campaigns c WHERE c.id = ugc_campaign_products.campaign_id AND c.user_id = auth.uid()::text)
);
