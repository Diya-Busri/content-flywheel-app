-- Daily goal tracker: goals and daily_tasks with RLS for user-only access

-- Goals table (user_id is text for Clerk compatibility)
CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "target_date" timestamp NOT NULL,
  "total_days" integer NOT NULL,
  "current_day" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "streak_count" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Daily tasks table (one row per task per day per goal)
CREATE TABLE IF NOT EXISTS "daily_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "day_number" integer NOT NULL,
  "task_description" text NOT NULL,
  "is_completed" boolean DEFAULT false NOT NULL,
  "proof_type" text NOT NULL,
  "proof_url" text,
  "proof_text" text,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Index for faster lookups by goal and day
CREATE INDEX IF NOT EXISTS "daily_tasks_goal_id_day_number_idx" ON "daily_tasks" ("goal_id", "day_number");
CREATE INDEX IF NOT EXISTS "goals_user_id_idx" ON "goals" ("user_id");

-- Enable RLS on both tables
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_tasks" ENABLE ROW LEVEL SECURITY;

-- Goals: users can only access their own rows (auth.uid()::text matches user_id when using Supabase Auth)
CREATE POLICY "Users can view own goals" ON "goals"
  FOR SELECT USING (auth.uid()::text = "user_id");

CREATE POLICY "Users can insert own goals" ON "goals"
  FOR INSERT WITH CHECK (auth.uid()::text = "user_id");

CREATE POLICY "Users can update own goals" ON "goals"
  FOR UPDATE USING (auth.uid()::text = "user_id");

CREATE POLICY "Users can delete own goals" ON "goals"
  FOR DELETE USING (auth.uid()::text = "user_id");

-- Daily tasks: users can only access tasks for goals they own
CREATE POLICY "Users can view own daily tasks" ON "daily_tasks"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "goals" WHERE "goals"."id" = "daily_tasks"."goal_id" AND "goals"."user_id" = auth.uid()::text)
  );

CREATE POLICY "Users can insert own daily tasks" ON "daily_tasks"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM "goals" WHERE "goals"."id" = "daily_tasks"."goal_id" AND "goals"."user_id" = auth.uid()::text)
  );

CREATE POLICY "Users can update own daily tasks" ON "daily_tasks"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM "goals" WHERE "goals"."id" = "daily_tasks"."goal_id" AND "goals"."user_id" = auth.uid()::text)
  );

CREATE POLICY "Users can delete own daily tasks" ON "daily_tasks"
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM "goals" WHERE "goals"."id" = "daily_tasks"."goal_id" AND "goals"."user_id" = auth.uid()::text)
  );
