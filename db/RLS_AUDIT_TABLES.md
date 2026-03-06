# RLS Audit: Tables (brand_workspaces, brand_campaigns, etc.)

Audit of Row Level Security (RLS) and `user_id` policies for the requested tables.

---

## Summary

| Table            | RLS enabled | user_id policy | Notes |
|------------------|-------------|----------------|--------|
| brand_workspaces | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |
| brand_campaigns  | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |
| coach_settings   | ✅          | ✅              | No RLS in 0065; 0070 adds RLS + user_id policies. |
| chat_summaries   | ✅          | ✅              | No RLS in 0066; 0070 adds RLS + user_id policies. |
| saved_scripts    | ✅          | ✅              | No RLS in 0069; 0070 adds RLS + user_id policies. |
| template_packs   | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |
| brand_calendar   | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |
| drop_scripts     | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |
| launch_checklist | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |
| scheduled_posts  | ✅          | ✅ (after 0072) | Was `USING (true)`; fixed in 0072. |

---

## Details

### Tables with RLS but permissive policies (fixed in 0072)

These tables had RLS enabled in their create migrations but used **permissive** policies:

- `USING (true)` for SELECT/UPDATE/DELETE  
- `WITH CHECK (true)` for INSERT/UPDATE  

So every row was visible/editable when using the Supabase client with the anon key (no real row-level restriction).

**Tables:** brand_workspaces (0061), brand_campaigns (0062), template_packs (0057), brand_calendar (0058), drop_scripts (0059), launch_checklist (0060), scheduled_posts (0063).

**Fix:** Migration **0072_fix_rls_user_id_policies.sql** drops those policies and recreates them with:

- `USING (user_id = auth.uid()::text)` for SELECT, UPDATE, DELETE  
- `WITH CHECK (user_id = auth.uid()::text)` for INSERT, UPDATE  

So access is restricted to the owning user (Clerk `user_id` stored as text; `auth.uid()` set via JWT).

### Tables with RLS and user_id from 0070

These tables are created **without** RLS in their migrations; RLS and policies are added by **0070_rls_missing_tables.sql** (only for tables that exist):

- **coach_settings** (0065)  
- **chat_summaries** (0066)  
- **saved_scripts** (0069)  

0070 enables RLS and creates policies named `rls_<table>_select`, `rls_<table>_insert`, etc., all using `user_id = auth.uid()::text`.

---

## Migration order

1. Table creation migrations (0057–0063, 0065, 0066, 0069, 0071 if used).  
2. **0070_rls_missing_tables.sql** – RLS + user_id for coach_settings, chat_summaries, saved_scripts, etc.  
3. **0072_fix_rls_user_id_policies.sql** – Replace permissive policies with user_id policies on the seven tables above.

After running 0072, all ten tables have RLS enabled and a proper `user_id`-based policy.
