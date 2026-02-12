-- This app uses Clerk for auth, not Supabase Auth. RLS policies that use auth.uid()
-- fail when connecting via direct Postgres (auth.uid() is NULL). Disable RLS on
-- goals and daily_tasks; auth is enforced in API routes via Clerk.
ALTER TABLE "goals" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_tasks" DISABLE ROW LEVEL SECURITY;
