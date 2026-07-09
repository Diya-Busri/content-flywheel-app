# Strategic Reset — June 2026

> **Priority order:** Income → Cut costs → Preserve project → Return later from a stronger position.

---

## 1. Job Search — Quick Income

You're a CS student open to retail, hospitality, and admin. The goal is cash flow, not career perfection. Here's how to move fast.

### Where to apply (this week)

**Immediate / walk-in ready**
- Supermarkets: Tesco, Sainsbury's, Asda, Lidl, Aldi — all hire online, often start within 1–2 weeks
- Fast food / cafe: McDonald's, Costa, Pret, Starbucks, Greggs — flexible shifts, good for students
- Retail: ASOS warehouse, Amazon fulfilment, Next, H&M
- Admin / office: Temping agencies (Hays, Reed, Randstad, Adecco) — register online, can place within days

**Apply to all of these today — takes 15–30 mins each:**
1. Indeed.co.uk → search "part time [your city]", filter by "part time", apply to 10+ roles
2. CV Library → same approach
3. Totaljobs.co.uk
4. Reed.co.uk → especially for admin/temping roles

### CV for non-tech roles

Keep it to 1 page. Emphasise:
- Availability (state your hours clearly — e.g. "available weekdays and weekends")
- Any prior customer-facing experience
- Reliability, fast learner — don't over-engineer it
- Brief mention of your startup shows initiative — keep it to one line

### Also worth exploring (CS student angle)

While you're applying for quick income, these won't start as fast but are worth 1–2 applications each:

- **University part-time work**: Check your uni's job board — research assistant, IT helpdesk, lab demonstrator roles often available
- **Freelance platforms**: Upwork, Fiverr — small dev tasks, £20–£100/job, no commitment
- **Toptal / Turing**: Higher bar but better rates if your portfolio is strong
- **Placement year / sandwich year**: If your course supports it, apply to tech companies (Dyson, IBM, Sky, Shopify UK, Monzo, Wise) — many deadlines are Sep–Nov

### Weekly cadence

- **Day 1**: Register on Indeed, Reed, CV Library. Apply to 10 quick roles.
- **Day 2–3**: Walk into local shops/cafes with a printed CV. Genuinely still works.
- **Day 4–5**: Follow up any applications. Apply 10 more online.
- **Ongoing**: 10 applications/day until you land something.

---

## 2. Subscription Audit

### Services detected in your codebase — review each

| Service | What it does | Monthly cost est. | Keep? |
|---|---|---|---|
| **Supabase** | Database (PostgreSQL) | Free tier likely | ✅ Keep — free tier, data lives here |
| **Clerk** | Auth | Free up to 10k MAU | ✅ Keep — free tier |
| **Stripe** | Payments | % of revenue only | ✅ Keep — no fixed cost |
| **Vercel** | Hosting | Free–$20/mo | ⚠️ Check — downgrade to Hobby (free) if on Pro |
| **Fal.ai** | AI image/video gen | Pay per use | ⚠️ Stop using — only trigger on demand |
| **Creatomate** | Video rendering | Subscription | ❌ Pause/cancel — check if free tier exists |
| **Shotstack** | Video rendering | Pay per use | ⚠️ Stop triggering — pause API calls |
| **OpenAI** | LLM | Pay per use | ⚠️ Stop auto-running — only on demand |
| **Resend** | Email | Free up to 3k/mo | ✅ Keep — free tier |
| **Remotion** | Video rendering (local) | Free | ✅ Keep — no cost |
| **Whop** | Payments alt | % of revenue | ✅ Keep — no fixed cost |
| **Higgsfield** | AI video gen | Subscription/credits | ❌ Cancel/pause immediately — highest cost |
| **Railway** | Video render server hosting | ~$5–20/mo | ❌ Pause or delete the server — not needed while paused |
| **Vercel Blob** | File storage | Pay per GB | ⚠️ Check usage — may be small |

### Action list — do this today

1. **Higgsfield** — cancel or pause subscription. This is your biggest discretionary spend.
2. **Railway** — pause or delete the `video-render-server` deployment. No active users = no need to run it.
3. **Vercel** — confirm you're on Hobby (free) not Pro.
4. **Creatomate** — check if you're on a paid plan. If yes, cancel or downgrade.
5. **Fal.ai / Shotstack / OpenAI** — no action needed if pay-per-use. Just don't trigger them manually.
6. **Any domain registrations** — audit GoDaddy/Namecheap/Cloudflare. Cancel unused domains.
7. **Any other SaaS you pay for** (Notion, Figma, Loom, etc.) — downgrade to free tier.

### Target monthly burn after cuts

| Category | Before | After |
|---|---|---|
| AI generation tools | £30–80+ | £0 (paused) |
| Hosting (Railway + Vercel) | £10–25 | ~£0 |
| Everything else | ~£10 | ~£0 |
| **Total** | **£50–100+/mo** | **~£0–5/mo** |

---

## 3. Content Flywheel — Archive & Pause

### What is it

A Next.js 14 SaaS for content creators — AI-powered video generation, brand kit, content calendar, digital products store, email marketing, affiliate system, UGC lab, and more.

**Tech stack**: Next.js 14 (App Router) · Supabase (PostgreSQL, Drizzle ORM) · Clerk (auth) · Stripe + Whop (payments) · Fal.ai (AI gen) · Remotion + Creatomate + Shotstack (video) · Resend (email) · Vercel (hosting) · Railway (video render server) · AWS S3 (storage)

### Current state (as of June 2026)

**Built and working:**
- Full auth flow (Clerk)
- Stripe + Whop payment/subscription integration
- Dashboard with 30+ feature pages
- AI video generation pipeline (Fal.ai, Remotion, Creatomate, Shotstack)
- Brand kit / brand voice builder
- Content calendar
- Caption library
- Digital products / store
- Email marketing + sequences
- Affiliate system
- Bio page
- Analytics dashboard
- Admin panel
- Template studio
- Script checker
- Video timeline editor
- Connected accounts (Google, Facebook, Instagram OAuth)

**Status**: Product is built to usable stage. Bottleneck is distribution and funding, not development.

**Not yet done / next priorities (for when you return):**
- Paid user acquisition (ads, influencer seeding)
- Higgsfield video integration at scale
- SEO / organic content marketing
- Community / social proof

### Where everything lives

| Thing | Location |
|---|---|
| Main codebase | `/Users/diya/content-flywheel-app` |
| Database | Supabase project: `mjmmczeocsaukrvobves` |
| Hosting | Vercel (check dashboard for project name) |
| Video server | Railway — `video-render-server/` |
| Auth | Clerk dashboard |
| Payments | Stripe dashboard |
| Env vars | `.env.local` — back this up somewhere safe |

### Before you fully pause — checklist

- [ ] Back up `.env.local` to a secure location (password manager, encrypted note)
- [ ] Export Supabase database (Supabase dashboard → Settings → Database → Backups)
- [ ] Pause Railway video render server
- [ ] Cancel/pause Higgsfield subscription
- [ ] Downgrade Vercel to Hobby if on Pro
- [ ] Push latest code to GitHub if not already

### When you return

Pick up from here:
1. Restore `.env.local`
2. `npm install` in root + `video-render-server/`
3. Run `npm run dev` — should work immediately
4. Focus on one distribution channel (e.g. TikTok organic or Reddit) before spending on ads

---

## Summary

You're not failing — you're being strategic. The product exists. The code isn't going anywhere. Getting stable income now means you can invest properly later instead of draining savings on credits and hoping for traction.

**Immediate priorities:**
1. Apply to 10 quick jobs today (Indeed, Reed, walk-ins)
2. Cancel Higgsfield and pause Railway today
3. Push code to GitHub and back up `.env.local`

That's it. Everything else can wait.
