-- Onboarding: track completion and checklist steps (Clerk userId used in app).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_steps jsonb DEFAULT '{}'::jsonb;
