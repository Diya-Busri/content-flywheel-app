-- Support bug reports from chat (type = 'bug'). user_id nullable for anonymous reports.
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'feedback';

ALTER TABLE public.feedback
  ALTER COLUMN user_id DROP NOT NULL;
