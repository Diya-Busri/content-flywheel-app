-- Lead capture from chat widget (logged-out users).
CREATE TABLE IF NOT EXISTS public.chat_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_leads_email_created_at ON public.chat_leads (email, created_at);
