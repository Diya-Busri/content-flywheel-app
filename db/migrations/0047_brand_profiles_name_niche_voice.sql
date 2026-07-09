-- Brand name, niche/industry, and brand voice for settings and onboarding.
ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS brand_name text;

ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS niche_industry text;

ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS brand_voice text;
