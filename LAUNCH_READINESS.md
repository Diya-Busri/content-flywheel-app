# Content Flywheel — Launch Readiness Checklist

> Produced: 2026-07-07 | Based on full codebase audit  
> Status key: ✅ Done · ⚠️ Partial · ❌ Missing · 🔧 Action required

---

## PRIORITY 1 — Must complete before launch

These are blockers. Shipping without them means money lost, data exposed, or the app broken for real users.

---

### Environment Variables

| Item | Status | Action |
|------|--------|--------|
| `STRIPE_SECRET_KEY` — production key | ❌ | Replace `sk_test_51Sa7kw…` with `sk_live_…` in Vercel env |
| `STRIPE_PUBLISHABLE_KEY` — production key | ❌ | Replace `pk_test_51Sa7kw…` with `pk_live_…` in Vercel env |
| `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_YEARLY_PRICE_ID` | ⚠️ | Create matching prices in live Stripe dashboard; update IDs |
| `STRIPE_WEBHOOK_SECRET` — production endpoint | ❌ | Register `https://contentflywheel.co.uk/api/webhooks/stripe` in Stripe live dashboard; replace `whsec_…` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — production | ❌ | Currently `pk_test_…`; switch Clerk instance to production and update |
| `CLERK_SECRET_KEY` — production | ❌ | Switch to production Clerk instance secret |
| `CLERK_WEBHOOK_SECRET` — production endpoint | ❌ | Register production Clerk webhook URL; update secret |
| `NEXT_PUBLIC_APP_URL` | ❌ | Change `http://localhost:3000` → `https://contentflywheel.co.uk` in Vercel env |
| `NEXT_PUBLIC_BASE_URL` | ❌ | Add to Vercel env (used by `app/sitemap.ts`); value: `https://contentflywheel.co.uk` |
| `ADMIN_EMAIL` | ❌ | Set to your real email address — currently blank (admin bypass non-functional) |
| `FACEBOOK_APP_SECRET` | ❌ | Replace placeholder `your_facebook_app_secret` with real secret |
| `CLERK_COOKIE_DOMAIN` | ❌ | Change from `localhost` → `.contentflywheel.co.uk` (with leading dot for subdomain support) |

---

### Stripe Production Mode

- ❌ **Create live Stripe products and prices** — Monthly + Yearly plans must exist in live mode with matching `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_YEARLY_PRICE_ID`
- ❌ **Register live webhook endpoint** — `https://contentflywheel.co.uk/api/webhooks/stripe` — subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- ❌ **Test the full purchase flow end-to-end in production** before announcing beta — use a real card, verify the Clerk user gets a subscription record
- ✅ Webhook idempotency guard in place (`stripeSessionId` check + `onConflictDoNothing`)
- ✅ Stripe webhook signature verification in place (`constructEvent`)
- ⚠️ **Stripe Connect payouts** — verify seller Stripe account links work in live mode (they use `sk_live_` implicitly once env is swapped)

---

### Security Headers

None of the following headers are set anywhere in the codebase. Add them to `next.config.mjs` via the `headers()` function:

```js
// next.config.mjs — add inside nextConfig object
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.contentflywheel.co.uk https://js.stripe.com https://challenges.cloudflare.com",
            "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https: wss:",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
          ].join("; "),
        },
      ],
    },
  ];
},
```

> ⚠️ Test CSP in report-only mode first (`Content-Security-Policy-Report-Only`) — Clerk, Stripe iframes, and fal.ai streams can trip strict policies.

- ❌ `X-Frame-Options: DENY` — missing (clickjacking risk)
- ❌ `Strict-Transport-Security` — missing (HSTS; enforce HTTPS)
- ❌ `X-Content-Type-Options: nosniff` — missing (MIME sniffing)
- ❌ `Content-Security-Policy` — missing (XSS mitigation)
- ❌ `Referrer-Policy` — missing
- ✅ Image proxy SSRF protection — fixed (allowlist in place)
- ✅ Stripe webhook signature verification — in place
- ✅ Clerk auth on all `/dashboard/**` routes

---

### Error Monitoring

No Sentry or equivalent is installed. On day one with 100 real users, silent crashes become lost revenue.

- ❌ **Install Sentry**: `npm install @sentry/nextjs`
- ❌ **Run `npx @sentry/wizard@latest -i nextjs`** — generates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- ❌ **Add `SENTRY_DSN` to Vercel env**
- ❌ **Configure source maps upload** in `next.config.mjs` via `withSentryConfig()`
- ❌ **Wire Sentry into existing `app/error.tsx`** — call `Sentry.captureException(error)` in the `useEffect`
- ❌ **Add Sentry to `app/dashboard/error.tsx`** — same pattern
- ⚠️ Alternative: Vercel's built-in Log Drain → Datadog/Axiom is faster to set up if Sentry feels heavy for beta

---

### Database Migrations

- ✅ 119 migration files exist (`db/migrations/`)
- ✅ `npm run db:migrate` script available
- ❌ **Run all pending migrations on the production Supabase project** before launch — not just dev
- ❌ **Verify RLS policies** on all new tables added in last 30 migrations — tables created without RLS default to `public` access via `anon` key
- ❌ **Check that `pgvector` extension is enabled** on the production Supabase project (required by user-memory and intelligence-engine tables)
- ⚠️ `typescript: { ignoreBuildErrors: true }` in `next.config.mjs` — this silences real type errors at build time. Consider removing before launch or at minimum piping `tsc --noEmit` in CI.

---

### Domain Configuration

- ❌ **Add custom domain in Vercel** — Project → Settings → Domains → `contentflywheel.co.uk`
- ❌ **Set DNS records**: A record → Vercel IP, or CNAME `www` → `cname.vercel-dns.com`
- ❌ **SSL certificate** — Vercel provisions automatically once DNS propagates; verify it's active
- ❌ **`www` redirect** — configure in Vercel: `www.contentflywheel.co.uk` → `contentflywheel.co.uk` (or vice versa, pick one canonical)
- ⚠️ `metadataBase` in `app/layout.tsx` is already set to `https://contentflywheel.co.uk` ✅
- ⚠️ Sitemap hardcodes `https://contentflywheel.co.uk` — matches domain ✅

---

### Vercel Configuration

- ✅ `vercel.json` has 6 cron jobs configured
- ❌ **Vercel Pro required** for cron jobs and `maxDuration: 120` on streaming routes — verify plan is active
- ❌ **Set all production env vars in Vercel dashboard** (Project → Settings → Environment Variables) — do not rely on `.env.local` for production
- ❌ **Set `NODE_ENV=production`** — Vercel sets this automatically, but verify it's not overridden
- ⚠️ PWA is disabled in development (`disable: process.env.NODE_ENV === "development"`) — correct behaviour ✅
- ❌ **Verify Vercel Blob is provisioned** in the production project — `BLOB_READ_WRITE_TOKEN` is in `.env.example` but commented out in `.env.local`

---

### Cookie Consent (GDPR / UK PECR)

No cookie consent banner exists. Content Flywheel serves UK/EU users and uses cookies via Clerk (session), Stripe, and any analytics added. This is a legal requirement.

- ❌ **Install a consent library** — recommended: `react-cookie-consent` (lightweight) or Cookiebot (full compliance)
- ❌ **Banner must appear before setting non-essential cookies** — analytics, marketing pixels
- ❌ **Link to `/cookie-policy`** from the banner — the page exists ✅, just needs the banner
- ❌ **Update `app/cookie-policy/page.tsx`** to list all cookies actually set (Clerk `__session`, Stripe `_stripe_*`, analytics)
- ⚠️ Clerk essential session cookies are exempt from consent (strictly necessary)

---

### Legal Pages

- ✅ `/privacy` — page exists
- ✅ `/terms` — page exists  
- ✅ `/cookie-policy` — page exists
- ✅ `/refund-policy` — page exists
- ❌ **Review all four pages with a solicitor or legal template service** — generic placeholder text is a liability risk
- ❌ **Privacy policy must disclose all data processors**: Clerk, Supabase, Stripe, Resend, OpenAI, ElevenLabs, fal.ai, HeyGen, Vercel
- ❌ **Terms must include subscription cancellation terms** that match your actual Stripe billing behaviour

---

### Email Deliverability

- ✅ Resend is installed (`resend: ^6.9.2`)
- ❌ **Verify your sending domain** in Resend dashboard — add SPF, DKIM, DMARC records to your DNS
  - SPF: `v=spf1 include:amazonses.com ~all` (Resend uses SES)
  - DKIM: Resend generates the CNAME records
  - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@contentflywheel.co.uk`
- ❌ **Set `RESEND_API_KEY`** in Vercel env with production Resend key
- ❌ **Test welcome email** triggered by `CLERK_WEBHOOK_SECRET` → `user.created` event end-to-end
- ❌ **Test order receipt email** after a real Stripe checkout in production mode
- ⚠️ Check Resend free tier limits — 3,000 emails/month free; 100 users at beta should be fine, but monitor

---

## PRIORITY 2 — Should complete before launch

Important for a credible beta. Not immediate blockers, but will cause problems within the first week.

---

### Analytics Tracking

No analytics package is installed — you'll have zero visibility into user behaviour from day one.

- ❌ **Install Vercel Analytics** — `npm install @vercel/analytics`; add `<Analytics />` to `app/layout.tsx`. Free on all Vercel plans. Zero-config.
- ❌ **Install Vercel Speed Insights** — `npm install @vercel/speed-insights`; add `<SpeedInsights />` to `app/layout.tsx`. Tracks Core Web Vitals per page.
- ⚠️ Optional but recommended for beta: PostHog (event tracking, session replay, feature flags) — `npm install posthog-js`; add `NEXT_PUBLIC_POSTHOG_KEY` to Vercel env
- ❌ **Track key conversion events** once analytics is installed:
  - `sign_up_completed`
  - `launch_started` / `launch_completed`
  - `product_created`
  - `checkout_started` / `checkout_completed`
  - `video_credits_used`

---

### Structured Logging

Currently 113 `console.error`/`console.warn` calls scattered across `lib/`. These disappear in Vercel's log rotation after 1 hour on the free plan.

- ❌ **Add Vercel Log Drain** — Project → Settings → Log Drains → connect to Axiom, Datadog, or Logtail (Axiom has a generous free tier). This persists all server logs.
- ⚠️ Alternative minimum: wrap critical paths in structured log objects: `console.error("[stripe-webhook]", { event: type, sessionId, error })` — structured JSON is searchable in Vercel's log UI
- ❌ **Add a health check endpoint** — `app/api/health/route.ts` returning `{ status: "ok", db: true, ts: Date.now() }` — needed for uptime monitoring

---

### Rate Limiting — Upstash

- ⚠️ `checkAiRateLimitAsync` and `checkApiRateLimit` both support Upstash but fall back to in-memory when env vars are missing
- ❌ **Provision Upstash Redis** — free tier covers beta scale (10k commands/day free)
- ❌ **Add to Vercel env**:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Once added, rate limits are shared across all Vercel instances automatically — no code changes needed

---

### Open Graph Image

- ⚠️ OG metadata is set in `app/layout.tsx` (title, description, `twitter:card: summary_large_image`) ✅
- ❌ **No actual OG image file exists** — Twitter/LinkedIn will show a blank card without one
- ❌ **Create `app/opengraph-image.tsx`** using Next.js ImageResponse:

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Content Flywheel — Create & Market Digital Products with AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div style={{ background: "#0f0f0f", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: 64, fontWeight: 700, color: "#f97316", marginBottom: 24 }}>Content Flywheel</div>
      <div style={{ fontSize: 28, color: "#e5e7eb", textAlign: "center", maxWidth: 800 }}>
        Create & Market Digital Products with AI
      </div>
    </div>
  );
}
```

- ❌ **Add per-product OG image** — `app/product/[id]/opengraph-image.tsx` using product thumbnail + name

---

### SEO

- ✅ `app/sitemap.ts` — dynamic sitemap including published products
- ✅ `app/robots.ts` — blocks `/dashboard/`, `/api/`, `/admin/`
- ✅ `metadataBase` set correctly in `app/layout.tsx`
- ❌ **Submit sitemap to Google Search Console** — `https://contentflywheel.co.uk/sitemap.xml`
- ❌ **Submit sitemap to Bing Webmaster Tools**
- ❌ **Verify site in Google Search Console** — add DNS TXT record or HTML meta tag
- ❌ **Add `canonical` to sitemap pages** — `app/layout.tsx` already has `alternates.canonical` ✅ but confirm each marketing page has its own canonical
- ⚠️ Landing page (`/faceless`, `/blog/faceless-creator`) are in sitemap but verify these pages exist and load correctly

---

### Performance Optimisation

- ✅ PWA with workbox caching enabled in production
- ✅ `navigateFallbackDenylist` prevents dashboard/API routes being served from cache
- ⚠️ `webpack: { cache: false }` — disabling webpack cache speeds dev restarts but does not affect production bundle
- ❌ **Run Lighthouse on production** — target 90+ on Performance, 100 on SEO
- ❌ **Audit `next/image` usage** — ensure all `<img>` tags in high-traffic pages use `<Image>` with `width`, `height`, and `priority` on LCP images
- ❌ **Enable ISR or `revalidate` on the marketplace page** — currently `force-dynamic`; at scale this will be expensive
- ❌ **Check bundle size** — `next build` output shows page sizes; investigate any route over 500kB (likely the Design Studio or TipTap editor)
- ⚠️ Streaming AI routes (`maxDuration: 120`) require Vercel Pro — confirm this is active

---

### Backup Strategy

No backup procedure exists or is documented anywhere in the codebase.

- ❌ **Enable Supabase Point-in-Time Recovery (PITR)** — Supabase Pro plan; restores to any second in the last 7 days
- ❌ **Schedule daily logical backups** — Supabase Dashboard → Database → Backups; enable daily backups (free on Pro)
- ❌ **Export critical tables manually before launch** — `pg_dump` of `products`, `profiles`, `product_orders`, `launch_projects` as a pre-launch snapshot
- ❌ **Document restore procedure** — who runs it, where the backup is, how long it takes
- ⚠️ Vercel Blob is not backed up by default — important assets (AI-generated images, video files) should be periodically mirrored to R2/S3 if loss would be catastrophic

---

### Rollback Procedure

- ❌ **Document rollback steps**:
  1. Go to Vercel Dashboard → Deployments → find last known-good deployment
  2. Click ⋮ → "Promote to Production" — instant; no redeploy needed
  3. If DB migration was the problem: restore from Supabase PITR backup to pre-migration timestamp
  4. Notify users via status page if downtime > 5 minutes
- ❌ **Never run irreversible DB migrations at launch time** — run migrations 24h before, verify, then cut traffic over
- ⚠️ Vercel's deployment history retains all previous builds — rollback is always possible without extra setup

---

### Gated Features / Passwords

- ❌ **Set `GATED_FEATURES_PASSWORD`** — currently blank; all gated features are unlocked for anyone who guesses the route
- ❌ **Set `ADMIN_EMAIL`** to your real email — admin bypass currently non-functional
- ⚠️ Consider removing feature gates entirely for features you want all beta users to access; keeping blank passwords is a false sense of security

---

## PRIORITY 3 — Can wait until after beta

These are genuine improvements but won't block or break the launch. Revisit after the first 2 weeks of beta feedback.

---

### Disaster Recovery

- ❌ **Define RTO / RPO** — how long can the app be down? how much data can you lose? (Suggested beta targets: RTO 4h, RPO 24h)
- ❌ **Multi-region consideration** — Vercel deploys to Edge globally; Supabase is single-region (eu-west-2 or similar) — document the single point of failure
- ❌ **Status page** — create a free status page on Instatus or Betteruptime so users have somewhere to check during incidents; link from footer
- ❌ **Incident runbook** — who gets paged, what's the escalation path, Stripe / Supabase / Vercel support contacts

---

### Accessibility Review

- ⚠️ `radix-ui` components (used via shadcn/ui) have good baseline ARIA support
- ❌ **Run axe DevTools** on: dashboard home, product creation flow, marketplace, checkout
- ❌ **Keyboard navigation test**: Tab through the 5-step Launch pipeline without a mouse
- ❌ **Colour contrast audit** — orange-on-white (`text-orange-500` on white backgrounds) may fail WCAG AA 4.5:1 ratio; verify with a contrast checker
- ❌ **Screen reader test** on the Design Studio canvas — canvas elements have no semantic structure
- ❌ **Add `aria-label`** to icon-only buttons (the ⋮ menus, collapse/expand controls in sidebar)

---

### Cross-Browser & Mobile Testing

- ❌ **Test in**: Chrome (latest), Safari 17 (macOS + iOS), Firefox (latest), Edge
- ❌ **Known Safari risk**: `min-h-dvh` is used extensively — verify on iOS 15 (partial support) vs iOS 16+ (full support)
- ❌ **Test PWA install flow** on iOS (Add to Home Screen) and Android (Chrome install prompt)
- ❌ **Test Stripe checkout popup** — Safari blocks third-party cookies which can affect Stripe redirect flow
- ❌ **Mobile breakpoint audit** on: Launch execution page (dense agent cards), Design Studio (canvas on small screen), Workspace Dashboard (multi-column)
- ❌ **Test file upload on mobile** — Supabase presigned URL upload from an iOS browser

---

### Monitoring & Alerting

- ❌ **Uptime monitor** — set up Betteruptime, UptimeRobot, or Vercel's built-in checks on:
  - `https://contentflywheel.co.uk` (homepage)
  - `https://contentflywheel.co.uk/api/health` (health endpoint — needs creating, see Priority 2)
  - `https://contentflywheel.co.uk/dashboard` (should redirect to sign-in, not error)
- ❌ **Stripe webhook failure alerts** — enable Stripe Dashboard → Developers → Webhooks → alert on 5xx responses
- ❌ **Vercel spend alerts** — set a budget alert in Vercel billing to catch unexpected traffic spikes before they become a bill

---

### PWA Manifest

- ⚠️ `public/manifest.json` has only 2 icons — browsers prefer a full set
- ❌ **Generate a full icon set** (192×192, 512×512, 180×180 apple-touch-icon, 32×32 favicon) using [realfavicongenerator.net](https://realfavicongenerator.net)
- ❌ **Add `theme_color` and `background_color`** matching brand orange (`#f97316`)

---

### TypeScript Build Safety

- ⚠️ `typescript: { ignoreBuildErrors: true }` in `next.config.mjs` — silences all type errors at build time
- ❌ **Remove this flag** after a clean `tsc --noEmit` pass — or at minimum add `tsc --noEmit` to the Vercel build command so errors surface in CI without blocking deploys immediately

---

### Structured Logging (upgrade)

- ❌ Replace ad-hoc `console.error` with a structured logger (e.g. `pino`) that outputs JSON — makes log drain queries (by route, userId, error code) far more effective
- ❌ Add `requestId` header to all API responses so individual requests can be traced across logs

---

## Quick Reference: Environment Variables for Vercel Production

Set all of these in Vercel → Project → Settings → Environment Variables → Production:

```
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...    ← from Clerk Dashboard → Webhooks
CLERK_COOKIE_DOMAIN=.contentflywheel.co.uk

# App
NEXT_PUBLIC_APP_URL=https://contentflywheel.co.uk
NEXT_PUBLIC_BASE_URL=https://contentflywheel.co.uk

# Stripe (live)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_MONTHLY_PRICE_ID=price_live_...
STRIPE_YEARLY_PRICE_ID=price_live_...
STRIPE_WEBHOOK_SECRET=whsec_...    ← from Stripe Dashboard → Webhooks

# Email
RESEND_API_KEY=re_live_...

# Database
DATABASE_URL=postgresql://...      ← Supabase production project
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Rate limiting (strongly recommended)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# AI (same keys work in prod — just set spend limits in each provider dashboard)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
FAL_API_KEY=...

# Error monitoring (after Sentry is installed)
SENTRY_DSN=https://...@sentry.io/...

# Analytics (after PostHog is installed — optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Admin
ADMIN_EMAIL=your@email.com
```

---

## Summary Scorecard

| Area | P1 (Must) | P2 (Should) | P3 (After beta) |
|------|-----------|-------------|-----------------|
| Env vars | ❌ 12 items | — | — |
| Stripe production | ❌ 5 items | — | — |
| Security headers | ❌ 5 headers | — | — |
| Error monitoring (Sentry) | ❌ Not installed | — | — |
| DB migrations | ❌ Run on prod | — | — |
| Domain / DNS | ❌ 4 items | — | — |
| Cookie consent | ❌ No banner | — | — |
| Legal pages | ❌ Review needed | — | — |
| Email deliverability | ❌ DNS not set | — | — |
| Analytics | — | ❌ Not installed | — |
| Logging / log drain | — | ❌ Not set up | — |
| Rate limiting (Upstash) | — | ❌ Env vars missing | — |
| OG image | — | ❌ No image file | — |
| SEO / Search Console | — | ❌ Not submitted | — |
| Performance | — | ⚠️ Audit needed | — |
| Backup strategy | — | ❌ Not configured | — |
| Rollback procedure | — | ❌ Not documented | — |
| Accessibility | — | — | ❌ Not audited |
| Cross-browser testing | — | — | ❌ Not done |
| Monitoring / uptime | — | — | ❌ Not set up |
| PWA icons | — | — | ⚠️ Only 2 icons |
| TypeScript build safety | — | — | ⚠️ Errors silenced |

**P1 blockers: 12** — none of these ship without resolution  
**P2 items: 7** — target completing before week 1 of beta  
**P3 items: 5** — tackle in first sprint post-launch
