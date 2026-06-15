# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Next.js dev server
npm run dev:clean        # Wipe .next cache then start dev (use when cache causes stale-build issues)
npm run build            # Production build
npm run lint             # ESLint (next/core-web-vitals)
npm run type-check       # tsc --noEmit (TypeScript strict check)

# Database
npm run db:generate      # Drizzle: generate migration files from schema changes
npm run db:migrate       # Drizzle: apply pending migrations to the database

# Video rendering (local only — not deployed)
npm run video            # Open Remotion Studio UI
npm run render           # Render ShowcaseVideo to out/video.mp4
```

There are no automated tests in this codebase.

## Architecture Overview

**Content Flywheel** is a SaaS platform for content creators to build digital products, generate AI-powered marketing videos, and manage sales workflows. It is a Next.js 14 App Router application deployed to Vercel.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, React Server Components) |
| Styling | Tailwind CSS + ShadCN UI (Radix primitives) + Framer Motion |
| Database | Supabase PostgreSQL via Drizzle ORM 0.33 |
| Auth | Clerk (OAuth + email) |
| Payments | Stripe or Whop — toggled by `ACTIVE_PAYMENT_PROVIDER` env var |
| AI Services | OpenAI, Anthropic (Claude), HeyGen, ElevenLabs, Fal.ai, Creatomate |
| Video | Remotion + FFmpeg + Puppeteer/Chromium (headless export) |
| File Storage | Vercel Blob |
| Email | Resend |
| Rate Limiting | Upstash Redis (falls back to in-memory if not configured) |

### Directory Layout

```
app/
  api/               # 400+ REST API route handlers (route.ts files)
  (auth)/            # Clerk sign-in/sign-up pages
  (marketing)/       # Public marketing/landing pages
  dashboard/         # All authenticated app routes
    admin/           # Admin-only features (feature flags, finances, users)
    digital-products/# Product creation wizard & editor
    content-studio/  # AI video script generation
    design-studio/   # Template-based design editor
    video/           # Video generation & analytics
    campaign-mode/   # Multi-workspace campaign management
    ai-coach/        # AI coaching chat widget
db/
  schema/            # 57+ Drizzle table definitions (one file per domain)
  migrations/        # Generated SQL migration files
  queries/           # Reusable Drizzle query helpers
  db.ts              # Postgres client + Drizzle instance + schema registry
lib/                 # ~70 utility modules
  api-validate.ts    # Zod validation helpers for API routes
  feature-flags.ts   # Feature flag resolution logic
  sanitize-html.ts   # XSS sanitization (DOMPurify client / regex server)
actions/             # Next.js server actions (credits, profiles, Stripe/Whop)
components/          # Shared React components (ShadCN-based)
hooks/               # React hooks (notably useChatCoach)
prompts/             # AI prompt template strings
video-render-server/ # Remotion composition definitions
```

### Authentication & Authorization

Clerk middleware (`middleware.ts`) protects all `/dashboard/*` routes. All `/api/*` routes are public at the middleware level — individual handlers enforce auth by calling `auth()` from `@clerk/nextjs/server`.

- A Clerk webhook at `/api/auth/webhooks/clerk` fires on `user.created` to insert a `profiles` row and send a welcome email.
- The `ADMIN_EMAIL` env var grants full dashboard access without a subscription check.
- Supabase Row-Level Security (RLS) policies prevent direct client-side writes to sensitive tables. All DB operations go through server-side Drizzle (never the Supabase JS client directly).

### Database

Drizzle ORM with `postgres` driver pointed at Supabase's pgBouncer endpoint (port 6543). **`prepare: false` is required** because pgBouncer transaction mode does not support prepared statements — do not remove this.

Schema files live in `db/schema/` (one file per domain). `db/db.ts` imports them all and registers them in the Drizzle `schema` object. When adding a new table: create the schema file, import it in `db/db.ts`, run `npm run db:generate`, then `npm run db:migrate`.

Key tables: `profiles` (subscription/credits), `products`, `content_studio_videos`, `video_jobs`, `coach_chats`, `feature_flags`, `brand_workspaces`.

### API Route Pattern

Every route should follow this structure:

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateBody, safeString, LIMITS } from "@/lib/api-validate";
import { z } from "zod";

const BodySchema = z.object({
  text: safeString(LIMITS.stringMedium),
});

export async function POST(request: NextRequest) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [body, err] = await validateBody(request, BodySchema);
  if (err) return err;

  // ...handler logic
}
```

`validateBody` / `validateSearchParams` return a `[data, null] | [null, NextResponse]` tuple. Use `safeString(max)` instead of `z.string()` for any user-provided text — it strips control characters.

### Feature Flags

`lib/feature-flags.ts` defines two tiers:
- **Stable** (default ON): no DB flag needed to show; a flag with `enabled=false` hides it.
- **Beta** (default OFF): must have a DB flag with `enabled=true` to show (except admins, who always bypass).

Resolution priority: per-user flag > global flag > default (stable=ON, beta=OFF).

To graduate a feature from beta to stable: move its key from `BETA_FEATURES` set to the stable section and delete its DB flag via the Admin Feature Flags page.

### Payments

The `ACTIVE_PAYMENT_PROVIDER` env var switches between `"stripe"` and `"whop"`. Both providers share the same `profiles` table fields (`subscription_status`, `subscription_tier`). Stripe webhooks land at `/api/webhooks/stripe`; Whop webhooks at `/api/webhooks/whop`.

### Video Rendering

Two rendering paths exist:
1. **Remotion** (`video-render-server/`) — React-based compositions rendered server-side via `@remotion/renderer`. Used for Content Studio videos.
2. **Puppeteer + Chromium** (`@sparticuz/chromium-min`) — Headless browser export for template-based designs. Used only by `/api/templates/viral/export` and `/api/templates/kinetic/export`. These routes require the `outputFileTracingIncludes` config in `next.config.mjs`.

FFmpeg, Puppeteer, and Remotion binaries are all marked as `serverComponentsExternalPackages` and webpack `externals` — never attempt to bundle them.

### ProductEditor Debugging

If the ProductEditor page (`/dashboard/digital-products/`) shows a blank screen but API calls return 200:
1. Check browser Console (F12) for React errors (hydration mismatch, undefined property access).
2. If no console errors, inspect the DOM — look for `display:none` / `opacity:0` / `visibility:hidden` on the editor root.
3. Do not change code until the specific error is identified. The Cursor rules in `.cursor/rules/` document this debugging workflow in detail.

### Environment Variables

Copy `.env.example` to `.env.local`. Required groups:
- `DATABASE_URL` — Supabase pgBouncer URL (port 6543)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` + `CLERK_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + price IDs (or Whop equivalents)
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `NEXT_PUBLIC_APP_URL` — full domain used for OAuth callbacks and PDF export

Optional but recommended for production: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate limiting), `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `FAL_API_KEY`, `HEYGEN_API_KEY`, `RESEND_API_KEY`.

### Conventions

- **File naming**: kebab-case everywhere (`user-settings.ts`, `brand-profile-schema.ts`).
- **No CSS modules or styled-components** — Tailwind + ShadCN only.
- **No tRPC or GraphQL** — plain REST with `NextResponse.json()`.
- **`typescript.ignoreBuildErrors: true`** in `next.config.mjs` — the build does not fail on type errors. Always run `npm run type-check` manually.
- **Server actions** (`/actions`) are thin wrappers for credit mutations and subscription lookups. Heavy logic belongs in API routes.
- All AI provider secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) are server-only — never prefix with `NEXT_PUBLIC_`.
