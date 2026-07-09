-- ─────────────────────────────────────────────────────────────────────────────
-- Spend Guard: per-user monthly API call counter
-- Run this once in the Supabase SQL Editor (or as a migration).
-- If you previously ran v1 (no user_id column), run the ALTER TABLE block too.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table: one row per (user_id, provider, month)
--    user_id = Clerk userId for real users, "__system__" for internal routes
create table if not exists api_monthly_usage (
  id          bigint generated always as identity primary key,
  user_id     text        not null default '__system__',
  provider    text        not null,
  month       text        not null,  -- "YYYY-MM"
  call_count  integer     not null default 0,
  updated_at  timestamptz not null default now(),
  unique (user_id, provider, month)
);

-- If upgrading from v1 (global tracking, no user_id column):
-- ALTER TABLE api_monthly_usage
--   ADD COLUMN IF NOT EXISTS user_id text not null default '__system__';
-- ALTER TABLE api_monthly_usage
--   DROP CONSTRAINT IF EXISTS api_monthly_usage_provider_month_key;
-- ALTER TABLE api_monthly_usage
--   ADD CONSTRAINT api_monthly_usage_user_provider_month_key
--   UNIQUE (user_id, provider, month);

-- Index for fast per-user lookups
create index if not exists api_monthly_usage_lookup
  on api_monthly_usage (user_id, provider, month);

-- 2. RPC: atomically increment the counter and return the new value
create or replace function increment_api_usage(
  p_user_id  text,
  p_provider text,
  p_month    text
)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  insert into api_monthly_usage (user_id, provider, month, call_count, updated_at)
    values (p_user_id, p_provider, p_month, 1, now())
  on conflict (user_id, provider, month)
    do update set
      call_count = api_monthly_usage.call_count + 1,
      updated_at = now()
  returning call_count into new_count;

  return new_count;
end;
$$;

-- Grant execute permission to service_role (used by the spend-guard)
grant execute on function increment_api_usage(text, text, text) to service_role;
