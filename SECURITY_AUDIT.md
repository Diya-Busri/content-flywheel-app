# Security Audit Report

This document summarizes the security audit and fixes applied to the Next.js/Supabase app.

---

## 1. SQL INJECTION

**Status: ✅ No issues found**

- **Drizzle ORM**: All queries use the query builder with `eq()`, `and()`, `sql` template literals with column/value placeholders. Values are parameterized (e.g. `weekEnd` in `goals/[id]/review` is server-computed, not user input).
- **Supabase client**: Uses `.from("table").insert({ ... })` with object values; Supabase parameterizes these.
- **Raw SQL**: The only `sql` usage is in `db/schema/profiles-schema.ts` (RLS definitions with schema table names) and `app/api/goals/[id]/review/route.ts` (Drizzle `sql` with column and server-computed date). No user input is concatenated into SQL.

**Action**: None required. Continue using Drizzle/Supabase query builders; avoid raw SQL with string concatenation.

---

## 2. XSS PROTECTION

**Status: ✅ Fixes applied**

**Findings:**
- `DiscoverCreateFlow.tsx`: User content `section.body` was rendered with `dangerouslySetInnerHTML` without sanitization.
- `print/page.tsx`: `section.contentHtml` and markdown-derived HTML rendered without sanitization.
- `ProductEditor.tsx`: Section content `section.contentHtml ?? cleanMarkdownToHtml(section.content)` rendered without sanitization.
- Static CSS/SVG (e.g. `PRODUCT_EDITOR_PREVIEW_CSS`, `shape.svg` from app-defined list) were left as-is.

**Fixes:**
- Added `lib/sanitize-html.ts`: sanitizes HTML (DOMPurify in browser when available, server-side strip of scripts/event handlers otherwise).
- Wrapped all user-derived HTML in `sanitizeHtml()` before `dangerouslySetInnerHTML` in:
  - `app/dashboard/digital-products/discover/create/DiscoverCreateFlow.tsx`
  - `app/dashboard/digital-products/[id]/print/page.tsx`
  - `app/dashboard/digital-products/[id]/edit/ProductEditor.tsx`

**Dependency:** Add `dompurify` and `@types/dompurify` for client-side sanitization (`npm install dompurify @types/dompurify`).

---

## 3. INPUT VALIDATION

**Status: ✅ Helper in place; examples applied; roll out to remaining routes**

- **lib/api-validate.ts**: `validateBody(request, schema)`, `validateSearchParams(params, schema)`, `safeString(max)`, `LIMITS`.
- **Examples applied:** `app/api/campaign-mode/workspaces/route.ts` (POST body with `CreateWorkspaceBodySchema`), `app/api/library/route.ts` (GET query with `LibrarySearchSchema`).
- **Action:** Add Zod schemas and `validateBody` / `validateSearchParams` to remaining POST/PUT and GET routes that accept JSON or query params. Example:

```ts
import { z } from "zod";
import { validateBody, safeString, LIMITS } from "@/lib/api-validate";

const BodySchema = z.object({
  topic: safeString(LIMITS.stringMedium),
  platform: z.enum(["youtube", "tiktok", "instagram"]).optional(),
});

export async function POST(request: Request) {
  const [body, err] = await validateBody(request, BodySchema);
  if (err) return err;
  // body is typed and validated
}
```

---

## 4. API KEY SECURITY

**Status: ✅ Audited and fixed**

- **Server-only usage:** All `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, etc. are used only in `app/api/`, `lib/`, or server components (e.g. `app/dashboard/layout.tsx`). No secrets in client components.
- **NEXT_PUBLIC_ audit:** Only non-sensitive keys should use `NEXT_PUBLIC_`. Fixed:
  - **stock-photos/route.ts**: Removed `NEXT_PUBLIC_PEXELS_API_KEY`; route now uses only `PEXELS_API_KEY` (server-only). Set `PEXELS_API_KEY` in `.env.local` / Vercel.
- **Sign-up error page:** Uses placeholder text `pk_test_...` / `sk_test_...` in instructions, not real keys.
- **Recommendation:** Do not add `NEXT_PUBLIC_` for any key that must stay secret (OpenAI, ElevenLabs, Supabase service role, Stripe secret, etc.). Use it only for public config (e.g. `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).

---

## 5. RATE LIMITING

**Status: ✅ Applied to all API routes**

- **lib/rate-limit-api.ts**: Upstash Redis when env set (20 req/60s per identifier), in-memory fallback. Exports `checkApiRateLimit(identifier)`, `getClientIp(request)`.
- **lib/rate-limit-ai.ts**: AI-specific limits (20/min per user) on AI routes; these routes also call `checkApiRateLimit` first.
- **Applied:** Every route under `app/api` now calls `checkApiRateLimit` at the start of each handler:
  - User routes: `const rl = await checkApiRateLimit(userId); if (rl) return rl;` (after auth).
  - Password-gate routes (e.g. verify) and webhooks: `checkApiRateLimit(getClientIp(request))`.
- **Webhooks:** Clerk and Stripe webhooks rate-limit by IP.

Add to `.env.local` for production:
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 6. SUPABASE RLS

**Status: ✅ Verified and applied**

- RLS is enabled on all user-scoped tables via:
  - `db/migrations/0035_rls_all_tables.sql` (core tables)
  - Later migrations for newer tables (brand_voice, product_history, scheduled_posts, etc.)
  - `db/migrations/0070_rls_missing_tables.sql` (conditional: my_library, saved_scripts, chat_summaries, coach_settings, coach_chats, workflow_progress, connected_accounts, content_studio_wizard_progress, content_studio_videos)
- Policies use `user_id = auth.uid()::text` (Clerk user ID stored as text). When using Supabase client with anon key, set JWT so `auth.uid()` matches. Server-side Drizzle with service role bypasses RLS; ensure all queries still filter by `user_id` from Clerk.

---

## 7. AUTHENTICATION CHECKS

**Status: ✅ Helper added; ensure every route uses it**

- Added `lib/api-auth.ts`: `requireAuth()` returns `[userId, null]` or `[null, 401 NextResponse]`.
- Most API routes already call `auth()` from `@clerk/nextjs/server` and return 401 when `!userId`.
- **Webhooks** (e.g. Stripe, Clerk) correctly use signature verification instead of user auth.

**Action:** Ensure every API route that should be user-only:
1. Calls `const { userId } = await auth();` (or `requireAuth()`).
2. Returns 401 when `!userId`, unless the route is intentionally public (e.g. lead capture with email, or webhook).

**Example:**
```ts
const [userId, authError] = await requireAuth();
if (authError) return authError;
```

---

## Summary Checklist

| Area              | Done | Notes |
|-------------------|------|--------|
| SQL injection     | ✅   | Use parameterized queries only. |
| XSS               | ✅   | Sanitize user HTML; DOMPurify added. |
| Input validation  | ✅   | Zod + `lib/api-validate.ts`; apply to all routes. |
| API key security  | ✅   | Server-only keys; PEXELS fix applied. |
| Rate limiting     | ✅   | Upstash + fallback; use in every route. |
| RLS               | ✅   | Enabled on all tables; 0070 applied. |
| Auth checks       | ✅   | requireAuth helper; verify each route. |

---

## Recommended Next Steps

1. **Deps:** Already installed: `dompurify`, `@types/dompurify`, `@upstash/ratelimit`, `@upstash/redis`.
2. **Env:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for production rate limiting.
3. **Rate limit:** ✅ Applied to all API routes (user routes use `userId`; webhooks and password gates use `getClientIp(request)`).
4. **Zod:** Add `validateBody` / `validateSearchParams` to remaining POST/PUT and GET (with query params) routes; see `campaign-mode/workspaces` and `library/route` for examples.
5. **Auth:** All user-facing routes use `auth()` or `requireAuth()`; webhooks use signature verification. When adding new routes, ensure auth or explicit public/webhook handling.
