# Content Flywheel — Feature Log

Live at: https://contentflywheel.co.uk
Repo: https://github.com/contentflywheel/content-flywheel-app
Vercel project: content-flywheels-projects/content-flywheel-app

---

## Sidebar (live in production)

### Top
- Academy
- AI Coach
- Design Studio
- Video Timeline
- Digital Products
- Video Guide
- Video Credits

### CONTENT
- My Library
- To-Do List

### SELL
- My Store
- Bundles
- Marketplace 🛍️
- Reviews ⭐
- Webhooks ⚡
- Invite Creators (referral program)

### Bottom
- Settings
- Leave a review
- Help
- Dark mode
- Video Credits balance
- Billing

---

## Features Built (by session)

### Product Page / Conversion
- [x] Social proof above the fold
- [x] Upsells moved before buy button
- [x] Refund/cancellation policy note + required pre-payment consent checkbox
- [x] FAQ section
- [x] JSON-LD structured data (SEO)
- [x] Exit-intent abandoned visitor offer
- [x] Countdown timer for sale price
- [x] Auto-apply coupon from URL (?coupon=CODE)
- [x] Post-purchase social share card
- [x] Custom thank-you message + bonus URL after purchase
- [x] Post-purchase upsell offer
- [x] Product embed buy-button widget (iframe)
- [x] Limited availability / sale end date
- [x] Pay-what-you-want / name your price

### Products & Bundles
- [x] Duplicate product button
- [x] Free product / lead magnet mode
- [x] Course/lesson format with gated content
- [x] Subscription/membership products
- [x] Product bundles (#62)
- [x] Per-product analytics on library cards
- [x] Product reviews & star ratings (#67)

### Store & Discovery
- [x] Show price on store product cards
- [x] Custom domain for creator store
- [x] Public product marketplace (#65)
- [x] Auto-generated sitemap (dynamic product pages) (#70)

### Promo & Discounts
- [x] Promo code manager UI
- [x] Bulk promo code generator (#64)

### Email & Marketing
- [x] Email capture on store & product pages
- [x] Waitlist auto-email when product publishes
- [x] Abandoned checkout recovery email
- [x] Email blast to product buyers
- [x] Email newsletter to full subscriber list
- [x] Post-purchase drip email sequences (#63)
  - Cron: daily at 9am UTC (/api/cron/email-sequences)

### Affiliates & Referrals
- [x] Affiliate/referral link system
- [x] Creator referral program (Invite Creators)

### Payments & Orders
- [x] Stripe Connect onboarding UI in Settings
- [x] Platform fee: 2% (destination charges)
- [x] Fix platform fee copy 5% → 2% (#60)
- [x] Buyer portal — /my-orders (email lookup)
- [x] PDF invoice generation for buyers (#69)
  - Route: /api/orders/[id]/invoice?token=TOKEN

### Analytics & Dashboard
- [x] Revenue goal widget on dashboard
- [x] Analytics dashboard
- [x] Order and customer dashboard

### Creator Tools
- [x] Creator onboarding checklist (#66)
- [x] Outbound webhooks (HMAC-signed) (#68)
  - Events: product_sold, bundle_sold
  - Route: /api/creator/webhooks

### Infra / Platform
- [x] Mobile responsiveness audit & fixes
- [x] Preview as buyer button in editor
- [x] Add "Preview as buyer" button in editor

---

## Database Migrations (run in Supabase SQL editor)
- 0001_email_sequence_enrollments.sql — email_sequence_enrollments table
- 0002_creator_webhooks.sql — creator_webhooks table

## Environment / Stack
- Next.js 14 (App Router)
- TypeScript + Drizzle ORM + PostgreSQL (Supabase)
- Stripe Connect (destination charges, 2% platform fee)
- Resend (transactional email)
- Clerk (auth)
- Vercel (hosting, daily cron)
- pdf-lib (invoice PDF generation)
- Node.js 22.x required (use nvm)

---

## Ideas Backlog (not built yet)
- [ ] A/B test product page headlines/prices
- [ ] Live social proof popups ("3 bought today")
- [ ] Cross-sell recommendations ("Also bought")
- [ ] Pay in instalments (Stripe)
- [ ] Pre-orders
- [ ] Tiered pricing / product variants (Basic/Pro/VIP)
- [ ] License key generator (software products)
- [ ] Product update emails to buyers
- [ ] Testimonial collection (auto-request 7d post-purchase)
- [ ] Creator public profile page (/creator/[username])
- [ ] Team accounts (invite VA/co-creator)
- [ ] Download limits per purchase
- [ ] Course progress tracking (student dashboard)
- [ ] Gift cards
- [ ] UTM link builder + attribution tracking
- [ ] Meta Pixel / GA4 event integration
- [ ] Email list segmentation by product
- [ ] VAT/tax calculation for EU buyers
- [ ] GDPR cookie consent
