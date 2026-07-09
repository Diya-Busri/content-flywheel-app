-- Enable RLS on tables that were missing it (user-scoped tables created after 0035).
-- Policies use auth.uid()::text to match Clerk user_id stored as TEXT.
-- Only runs for tables that EXIST, so safe to run even if some migrations (e.g. saved_scripts) haven't been applied yet.
-- Run in Supabase SQL Editor or via your migration runner.

DO $$
DECLARE
  t text;
  tbl text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'my_library', 'saved_scripts', 'chat_summaries', 'coach_settings', 'coach_chats',
    'workflow_progress', 'connected_accounts', 'content_studio_wizard_progress', 'content_studio_videos'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      tbl := quote_ident(t);
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_' || t || '_select" ON %s', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_' || t || '_insert" ON %s', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_' || t || '_update" ON %s', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_' || t || '_delete" ON %s', tbl);
      EXECUTE format('CREATE POLICY "rls_' || t || '_select" ON %s FOR SELECT USING (user_id = auth.uid()::text)', tbl);
      EXECUTE format('CREATE POLICY "rls_' || t || '_insert" ON %s FOR INSERT WITH CHECK (user_id = auth.uid()::text)', tbl);
      EXECUTE format('CREATE POLICY "rls_' || t || '_update" ON %s FOR UPDATE USING (user_id = auth.uid()::text)', tbl);
      EXECUTE format('CREATE POLICY "rls_' || t || '_delete" ON %s FOR DELETE USING (user_id = auth.uid()::text)', tbl);
      RAISE NOTICE 'RLS enabled on %', t;
    ELSE
      RAISE NOTICE 'Skipping % (table does not exist)', t;
    END IF;
  END LOOP;
END $$;
