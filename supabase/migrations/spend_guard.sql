-- ─────────────────────────────────────────────────────────────────────────────
-- Spend Guard: monthly API call counter
-- Run this once in the Supabase SQL Editor (or as a migration).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table: one row per (provider, month)
create table if not exists api_monthly_usage (
  id          bigint generated always as identity primary key,
  provider    text        not null,
  month       text        not null,  -- "YYYY-MM"
  call_count  integer     not null default 0,
  updated_at  timestamptz not null default now(),
  unique (provider, month)
);

-- Index for fast lookups
create index if not exists api_monthly_usage_lookup
  on api_monthly_usage (provider, month);

-- 2. RPC: atomically increment the counter and return the new value
create or replace function increment_api_usage(p_provider text, p_month text)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  insert into api_monthly_usage (provider, month, call_count, updated_at)
    values (p_provider, p_month, 1, now())
  on conflict (provider, month)
    do update set
      call_count = api_monthly_usage.call_count + 1,
      updated_at = now()
  returning call_count into new_count;

  return new_count;
end;
$$;

-- Grant execute permission to service_role (used by the spend-guard)
grant execute on function increment_api_usage(text, text) to service_role;
