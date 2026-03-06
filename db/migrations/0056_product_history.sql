-- Product history: one row per successful product generation (for History page).
CREATE TABLE IF NOT EXISTS product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  product_id UUID,
  product_title TEXT NOT NULL,
  format_type TEXT NOT NULL,
  content_json JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_history_user_id ON product_history (user_id);
CREATE INDEX IF NOT EXISTS idx_product_history_created_at ON product_history (created_at DESC);

ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_history_select_own" ON product_history;
CREATE POLICY "product_history_select_own" ON product_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_history_insert_own" ON product_history;
CREATE POLICY "product_history_insert_own" ON product_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "product_history_update_own" ON product_history;
CREATE POLICY "product_history_update_own" ON product_history FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "product_history_delete_own" ON product_history;
CREATE POLICY "product_history_delete_own" ON product_history FOR DELETE USING (true);
