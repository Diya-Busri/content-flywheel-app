-- Optional display name for public reviews (landing page).
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT;
