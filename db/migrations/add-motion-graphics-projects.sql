-- Motion Graphics Studio — Content Projects table
-- Run once against production database

CREATE TABLE IF NOT EXISTS motion_graphics_projects (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT         NOT NULL,
  name         TEXT         NOT NULL DEFAULT 'Untitled Project',
  content_mode TEXT         NOT NULL DEFAULT 'reddit-reaction',
  status       TEXT         NOT NULL DEFAULT 'draft',

  -- Source material
  source_text    TEXT NOT NULL DEFAULT '',
  source_url     TEXT,
  target_audience TEXT,
  main_opinion   TEXT,
  desired_cta    TEXT,
  cf_mention     TEXT NOT NULL DEFAULT 'subtle',
  video_duration TEXT,
  tone           TEXT,
  aspect_ratio   TEXT NOT NULL DEFAULT '9:16',

  -- AI-generated output (JSONB)
  analysis   JSONB,
  short_form JSONB,
  long_form  JSONB,

  -- Links to compiled template + render job
  template_id   UUID,
  render_job_id UUID,
  output_url    TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motion_graphics_projects_user_id
  ON motion_graphics_projects (user_id);

CREATE INDEX IF NOT EXISTS idx_motion_graphics_projects_status
  ON motion_graphics_projects (status);
