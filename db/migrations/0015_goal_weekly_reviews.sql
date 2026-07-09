-- Weekly honesty check: one row per goal per week (Monday date as YYYY-MM-DD)
CREATE TABLE IF NOT EXISTS "goal_weekly_reviews" (
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "week_start_date" text NOT NULL,
  "checked_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("goal_id", "week_start_date")
);
