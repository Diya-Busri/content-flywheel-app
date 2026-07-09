import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service_role key (bypasses RLS).
 * Required for storage uploads (e.g. voiceovers). Do NOT use the anon key here.
 *
 * Env vars (in .env.local or Vercel):
 * - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL — project URL (https://xxxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY — from Dashboard → Settings → API → service_role (secret)
 */
function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { getSupabaseAdmin };
