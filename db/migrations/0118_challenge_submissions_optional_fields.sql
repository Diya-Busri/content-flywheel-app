-- 100 Product Challenge — reduce required fields to improve completion rate.
-- Run via `npm run db:challenge-optional-fields` (see
-- scripts/run-challenge-submissions-optional-fields-migration.mjs), or paste
-- directly into the Supabase SQL Editor.
--
-- Price, "what makes it useful/different", and "what to improve" are useful
-- but not required before a submission can go through eligibility review —
-- they can be collected later by email if genuinely needed. Making them
-- optional here removes friction without losing any data for submissions
-- that do include them.

ALTER TABLE challenge_submissions ALTER COLUMN product_price DROP NOT NULL;
ALTER TABLE challenge_submissions ALTER COLUMN what_makes_useful DROP NOT NULL;
ALTER TABLE challenge_submissions ALTER COLUMN what_to_improve DROP NOT NULL;
