-- Run this in Supabase SQL Editor if goals/daily_tasks don't exist yet.
-- Creates both tables with the full current schema (checklist-only + app integration).

-- Goals table (user_id is text for Clerk)
CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "target_date" timestamp NOT NULL,
  "total_days" integer NOT NULL,
  "daily_time_commitment" integer,
  "current_day" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "streak_count" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "last_skipped_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Daily tasks table (checklist only, no proof columns; with app_action support)
CREATE TABLE IF NOT EXISTS "daily_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "day_number" integer NOT NULL,
  "task_description" text NOT NULL,
  "estimated_duration" integer,
  "how_to_complete" text,
  "is_completed" boolean DEFAULT false NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "task_type" text DEFAULT 'external' NOT NULL,
  "app_link" text,
  "app_label" text,
  "category" text,
  "completed_at" timestamp,
  "proof_required" boolean DEFAULT true NOT NULL,
  "proof_type" text,
  "proof_url" text,
  "proof_text" text,
  "proof_submitted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "daily_tasks_goal_id_day_number_idx" ON "daily_tasks" ("goal_id", "day_number");
CREATE INDEX IF NOT EXISTS "goals_user_id_idx" ON "goals" ("user_id");

ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON "goals"
  FOR SELECT USING (auth.uid()::text = "user_id");
CREATE POLICY "Users can insert own goals" ON "goals"
  FOR INSERT WITH CHECK (auth.uid()::text = "user_id");
CREATE POLICY "Users can update own goals" ON "goals"
  FOR UPDATE USING (auth.uid()::text = "user_id");
CREATE POLICY "Users can delete own goals" ON "goals"
  FOR DELETE USING (auth.uid()::text = "user_id");

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
