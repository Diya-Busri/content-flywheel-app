-- Add clerk_user_id for Clerk auth (user_id is UUID for Supabase Auth; we store Clerk ID here).
-- Make user_id nullable so inserts from Next.js (Clerk) can omit it.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

ALTER TABLE public.reviews
  ALTER COLUMN user_id DROP NOT NULL;
