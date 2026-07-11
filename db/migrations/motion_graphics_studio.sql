-- Motion Graphics Studio (admin-only feature)
-- Idempotent — safe to run multiple times. Applied via:
--   node scripts/run-motion-graphics-migration.mjs
-- (drizzle-kit's migration journal has drifted from db/schema/index.ts in this
-- repo, so new features are shipped as standalone idempotent SQL scripts —
-- see run-designs-migration.mjs / run-brand-workspaces-migration.mjs for the
-- same pattern.)

CREATE TABLE IF NOT EXISTS motion_graphics_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  fps INTEGER NOT NULL DEFAULT 30,
  scenes JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  source_script TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS motion_graphics_templates_user_id_idx
  ON motion_graphics_templates (user_id);

CREATE TABLE IF NOT EXISTS motion_graphics_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS motion_graphics_assets_user_id_idx
  ON motion_graphics_assets (user_id);
CREATE INDEX IF NOT EXISTS motion_graphics_assets_kind_idx
  ON motion_graphics_assets (kind);

CREATE TABLE IF NOT EXISTS motion_graphics_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'mp4',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  stage TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT 'Queued…',
  output_url TEXT,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS motion_graphics_render_jobs_template_id_idx
  ON motion_graphics_render_jobs (template_id);
CREATE INDEX IF NOT EXISTS motion_graphics_render_jobs_user_id_idx
  ON motion_graphics_render_jobs (user_id);
