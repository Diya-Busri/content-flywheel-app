-- Goal tracker: daily_time_commitment as integer (minutes), tasks without proof columns

-- Goals: daily_time_commitment as integer (minutes per day)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'daily_time_commitment'
      AND data_type IN ('character varying', 'text')
  ) THEN
    -- Column exists as text (from 0006): add integer column, backfill, drop text, rename
    ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "daily_time_commitment_min" integer;
    UPDATE "goals"
    SET "daily_time_commitment_min" = CASE "daily_time_commitment"::text
      WHEN '30min' THEN 30
      WHEN '1hr' THEN 60
      WHEN '2hr' THEN 120
      WHEN '3hr' THEN 180
      WHEN '4hr+' THEN 240
      ELSE 60
    END
    WHERE "daily_time_commitment" IS NOT NULL;
    ALTER TABLE "goals" DROP COLUMN "daily_time_commitment";
    ALTER TABLE "goals" RENAME COLUMN "daily_time_commitment_min" TO "daily_time_commitment";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'daily_time_commitment'
  ) THEN
    -- No column yet: add integer column
    ALTER TABLE "goals" ADD COLUMN "daily_time_commitment" integer;
  END IF;
END $$;

-- Daily tasks: add estimated_duration (integer), order_index (integer); keep how_to_complete
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "estimated_duration" integer;
ALTER TABLE "daily_tasks" ADD COLUMN IF NOT EXISTS "order_index" integer DEFAULT 0 NOT NULL;

-- Backfill estimated_duration from duration (text) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_tasks' AND column_name = 'duration'
  ) THEN
    UPDATE "daily_tasks"
    SET "estimated_duration" = CASE "duration"::text
      WHEN '15min' THEN 15
      WHEN '30min' THEN 30
      WHEN '45min' THEN 45
      WHEN '1hr' THEN 60
      WHEN '2hr' THEN 120
      WHEN '3hr' THEN 180
      WHEN '4hr+' THEN 240
      ELSE 30
    END
    WHERE "duration" IS NOT NULL AND "estimated_duration" IS NULL;
    ALTER TABLE "daily_tasks" DROP COLUMN IF EXISTS "duration";
  END IF;
END $$;

-- Set order_index by existing row order per goal/day
UPDATE "daily_tasks" AS d
SET "order_index" = t.ord
FROM (
  SELECT id, (row_number() OVER (PARTITION BY goal_id, day_number ORDER BY created_at, id)) - 1 AS ord
  FROM "daily_tasks"
) t
WHERE d.id = t.id;

-- Remove proof columns (checkboxes only, no uploads)
ALTER TABLE "daily_tasks" DROP COLUMN IF EXISTS "proof_type";
ALTER TABLE "daily_tasks" DROP COLUMN IF EXISTS "proof_url";
ALTER TABLE "daily_tasks" DROP COLUMN IF EXISTS "proof_text";
