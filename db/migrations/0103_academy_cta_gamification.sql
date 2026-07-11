-- Academy: action-based learning CTA fields on lessons
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS cta_label text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS cta_route text;
