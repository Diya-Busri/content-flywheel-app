-- Brand Builder Content Calendar: saved weeks (7 days each).
CREATE TABLE IF NOT EXISTS brand_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  days_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_calendar_user_id ON brand_calendar (user_id);
CREATE INDEX IF NOT EXISTS idx_brand_calendar_created_at ON brand_calendar (created_at DESC);

ALTER TABLE brand_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_calendar_select_own" ON brand_calendar;
CREATE POLICY "brand_calendar_select_own" ON brand_calendar FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_calendar_insert_own" ON brand_calendar;
CREATE POLICY "brand_calendar_insert_own" ON brand_calendar FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "brand_calendar_update_own" ON brand_calendar;
CREATE POLICY "brand_calendar_update_own" ON brand_calendar FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "brand_calendar_delete_own" ON brand_calendar;
CREATE POLICY "brand_calendar_delete_own" ON brand_calendar FOR DELETE USING (true);
