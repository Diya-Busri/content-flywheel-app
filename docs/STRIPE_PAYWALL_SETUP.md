# Stripe Paywall Setup

This app uses a **full paywall**: users must have an active subscription to access `/dashboard/*`. No free plan.

## 1. Environment variables (.env.local)

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_MONTHLY_PRICE_ID=price_xxx
STRIPE_YEARLY_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 2. Stripe Dashboard

- **Products** → Create product: **"Content Flywheel Pro"**
- Add two recurring prices:
  - **$69.99 USD** – monthly
  - **$671.90 USD** – yearly
- Copy the **Price IDs** into `.env.local` as `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_YEARLY_PRICE_ID`.

## 3. API routes (already implemented)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stripe-checkout` | POST | Body: `{ plan: "monthly" \| "yearly" }`. Returns `{ url }` for Stripe Checkout. |
| `/api/stripe-portal`   | POST | Returns `{ url }` for Stripe Customer Portal (manage subscription). |
| `/api/stripe/webhooks` | POST | Stripe webhook (see below). |

## 4. Webhook (required updates)

The webhook lives in `app/api/stripe/webhooks/route.ts` (that path may be in `.cursorignore`). Ensure it does the following.

### Verify signature

- Use `STRIPE_WEBHOOK_SECRET` with `stripe.webhooks.constructEvent(body, sig, webhookSecret)`.

### Events to handle

**`checkout.session.completed`** (mode === `subscription`):

- Get `subscriptionId` and `customerId` from the session.
- Call your existing `updateStripeCustomer(userId, subscriptionId, customerId)` so `stripe_customer_id` and `stripe_subscription_id` are stored.
- Fetch the subscription (e.g. `stripe.subscriptions.retrieve(subscriptionId)`).
- Update the user profile with:
  - `membership`: `"pro"`
  - `status`: `"active"`
  - `planDuration`: `"monthly"` or `"yearly"` (from `subscription.items.data[0].price.recurring?.interval`)
  - `billingCycleEnd`: `new Date(subscription.current_period_end * 1000)`
  - `stripePriceId`: `subscription.items.data[0].price.id` (if your schema has `stripe_price_id`)
- Do **not** reset or set `usageCredits` / `usedCredits` (credits system is removed).

**`customer.subscription.updated`**:

- Update profile so `status` and `billingCycleEnd` (and optionally `planDuration`, `stripePriceId`) match the subscription.
- Map Stripe status to your `status` (e.g. `active`, `past_due`, `canceled`).

**`customer.subscription.deleted`**:

- Set profile `status` to `"cancelled"` (or `"canceled"`).
- Set `membership` to `"free"` so the paywall redirects the user to `/pricing`.

You can remove or simplify handlers for `invoice.payment_succeeded` / `invoice.payment_failed` if they only existed for the old credits system.

## 5. Stripe actions (optional but recommended)

In `actions/stripe-actions.ts`:

- **`updateStripeCustomer`**: Ensure it stores `stripeCustomerId` and `stripeSubscriptionId` on the profile. Optionally set `membership: "pro"`, `status: "active"`, and billing fields there or in the webhook.
- **`manageSubscriptionStatusChange`**: When updating profile from a subscription object, set:
  - `status` from `subscription.status` (e.g. map to `active`, `past_due`, `cancelled`)
  - `billingCycleEnd` from `subscription.current_period_end`
  - `planDuration` from the price interval
  - `stripePriceId` from the price id
  - Do **not** set or reset `usageCredits` / `usedCredits`.

## 6. Paywall logic

- **Dashboard layout** (`app/dashboard/layout.tsx`): If the user is logged in but does **not** have an active subscription (`membership === "pro"` and `status` in `["active", "trialing"]`), they are redirected to `/pricing`.
- Only **subscribed** users can access `/dashboard/*`. All other pages (e.g. `/`, `/pricing`, `/sign-in`, `/sign-up`, `/api/stripe/*`) remain accessible without a subscription as needed.

## 7. Database

- Migration `0031_stripe_price_id.sql` adds `stripe_price_id` to `profiles`.
- Existing columns used for the paywall: `stripe_customer_id`, `stripe_subscription_id`, `status`, `billing_cycle_end`, `plan_duration`, `membership`.

After completing steps 2 and 4 (and optionally 5), the paywall and billing flows will work end-to-end.
