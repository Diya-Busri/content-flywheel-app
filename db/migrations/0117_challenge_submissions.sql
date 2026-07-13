-- 100 Product Challenge — public submission system.
-- Run via `npm run db:challenge` (see scripts/run-challenge-submissions-migration.mjs).
--
-- Not a competition: every eligible submission enters the production queue.
-- status is the single lifecycle field (see comment in
-- db/schema/challenge-submissions-schema.ts for the full ordered list):
--   new | under_review | more_info_required | ineligible |
--   eligible_awaiting_store_link | eligible_anonymous | store_link_received |
--   store_link_verified | ready_for_production | part1_in_production |
--   part1_published | part2_in_production | part2_published | completed
--
-- No user_id is required — this is a public, no-account-needed form.
-- linked_user_id / linked_store_product_id are filled in later by an admin
-- if/when the creator makes a real Content Flywheel account, without
-- duplicating this row.

CREATE TABLE IF NOT EXISTS challenge_submissions (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference                       TEXT NOT NULL,

  full_name                       TEXT NOT NULL,
  email                           TEXT NOT NULL,
  creator_or_business_name        TEXT,
  social_username                 TEXT,
  primary_social_platform         TEXT,

  product_name                    TEXT NOT NULL,
  product_type                    TEXT NOT NULL,
  product_description             TEXT NOT NULL,
  target_audience                 TEXT NOT NULL,
  problem_solved                  TEXT NOT NULL,
  product_price                   TEXT NOT NULL,
  product_status                  TEXT NOT NULL,
  existing_product_url            TEXT,
  what_makes_useful               TEXT NOT NULL,
  what_to_improve                 TEXT NOT NULL,

  marketing_struggles             JSONB NOT NULL DEFAULT '[]',
  marketing_tried                 TEXT,
  what_stopping_sales             TEXT,
  focus_request                   TEXT,
  do_not_say_or_show              TEXT,

  feature_type                    TEXT NOT NULL,
  anonymous_consent               BOOLEAN NOT NULL DEFAULT FALSE,

  ownership_confirmed             BOOLEAN NOT NULL DEFAULT FALSE,
  review_permission_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  queue_understanding_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,
  publication_order_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_risk_acknowledged     BOOLEAN NOT NULL DEFAULT FALSE,
  terms_agreed                    BOOLEAN NOT NULL DEFAULT FALSE,
  public_display_consent          BOOLEAN,
  store_link_obligation_ack       BOOLEAN,
  anonymous_no_link_ack           BOOLEAN,
  anonymous_blur_ack              BOOLEAN,
  marketing_opt_in                BOOLEAN NOT NULL DEFAULT FALSE,

  uploaded_files                  JSONB NOT NULL DEFAULT '[]',

  status                          TEXT NOT NULL DEFAULT 'new',
  ineligibility_reason            TEXT,
  admin_notes                     TEXT,

  store_url                       TEXT,
  store_link_verified             BOOLEAN NOT NULL DEFAULT FALSE,
  store_link_received_at          TIMESTAMPTZ,

  readiness_checklist             JSONB NOT NULL DEFAULT '{}',
  anonymity_checklist             JSONB NOT NULL DEFAULT '{}',

  email_history                   JSONB NOT NULL DEFAULT '[]',
  email_thread_id                 TEXT,

  episode_number                  INTEGER,
  part1_url                       TEXT,
  part2_url                       TEXT,

  linked_user_id                  TEXT,
  linked_store_product_id         UUID,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS challenge_submissions_reference_idx ON challenge_submissions(reference);
CREATE INDEX IF NOT EXISTS challenge_submissions_email_idx           ON challenge_submissions(email);
CREATE INDEX IF NOT EXISTS challenge_submissions_status_idx          ON challenge_submissions(status);
CREATE INDEX IF NOT EXISTS challenge_submissions_created_idx         ON challenge_submissions(created_at DESC);
