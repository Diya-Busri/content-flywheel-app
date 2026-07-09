import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";
import { createProfile } from "@/db/queries/profiles-queries";
import { FREE_SIGNUP_CREDITS } from "@/lib/video-credits";
import { awardVideoCredits } from "@/lib/award-credits";

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Content Flywheel <hello@contentflywheel.co.uk>";

type ClerkEmailAddress = { id: string; email_address?: string };
type ClerkUserPayload = {
  id?: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};
type ClerkWebhookPayload = { type: string; data: ClerkUserPayload };

function getEmail(data: ClerkUserPayload): string | null {
  const list = data.email_addresses;
  if (!Array.isArray(list) || list.length === 0) return null;
  const primaryId = data.primary_email_address_id;
  const primary = primaryId
    ? list.find((e) => e.id === primaryId)
    : list[0];
  const email = primary?.email_address ?? list[0]?.email_address;
  return typeof email === "string" && email.length > 0 ? email : null;
}


export async function POST(req: Request) {
  // No rate limiting — Svix signature verification is the security layer for webhooks
  if (!WEBHOOK_SECRET) {
    console.error("[Clerk webhook] CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing Svix headers" },
      { status: 400 }
    );
  }

  let body: string;
  try {
    body = await req.text();
  } catch (e) {
    console.error("[Clerk webhook] Failed to read body:", e);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let payload: ClerkWebhookPayload;
  try {
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookPayload;
  } catch (err) {
    console.warn("[Clerk webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (payload.type === "user.created") {
    const data = payload.data;
    const email = getEmail(data);
    const userId = data.id;

    // Create profile row for new user, then award signup credits via the central
    // awardVideoCredits() function (idempotent — safe against webhook retries and
    // the race where the dashboard fallback created the profile before this fires).
    if (userId) {
      try {
        // Profile starts at 0 video credits (DB default). awardVideoCredits() adds the 100.
        await createProfile({
          userId,
          email: email ?? undefined,
          membership: "free",
        });
      } catch (err) {
        console.error("[Clerk webhook] Failed to create profile:", err);
      }

      // Award signup credits — idempotency key prevents double-grant on webhook retry
      await awardVideoCredits({
        userId,
        amount: FREE_SIGNUP_CREDITS,
        reason: "🎁 Welcome credits — free on signup",
        idempotencyKey: `clerk:signup:${userId}`,
      }).catch((e) => console.error("[Clerk webhook] Failed to award signup credits:", e));
    }

    if (!RESEND_API_KEY) {
      console.error("[Clerk webhook] RESEND_API_KEY is not set — welcome email skipped");
    }

    if (RESEND_API_KEY && email) {
      const resend = new Resend(RESEND_API_KEY);
      const firstName = (data.first_name?.trim() || "there").replace(/</g, "&lt;");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

      const emailCard = (body: string) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Content Flywheel</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;">${body}</td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
          <p style="margin:0;color:#d1d5db;font-size:12px;">Powered by <strong style="color:#f97316;">Content Flywheel</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      const btn = (href: string, label: string) =>
        `<a href="${href}" style="display:inline-block;width:100%;max-width:100%;padding:14px 28px;background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;text-align:center;box-sizing:border-box;">${label}</a>`;

      const footer = `<hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 20px;"/>
        <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">&mdash; The Content Flywheel Team</p>`;

      // ── Day 0: Welcome ──────────────────────────────────────────────────────
      const { error: welcomeError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Welcome to Content Flywheel 👋",
        html: emailCard(`
          <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">You're in. Your 7-day free trial starts now.</p>
          <p style="margin:0 0 8px;color:#374151;font-size:15px;font-weight:600;">Here's what Content Flywheel does:</p>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">You pick a niche and a product idea. The AI builds the full digital product — ebook, guide, planner, workbook, checklist, or template — and then generates the marketing content (hooks, scripts, captions) to sell it. All in one place.</p>
          <p style="margin:0 0 8px;color:#374151;font-size:15px;font-weight:600;">Start here:</p>
          <ol style="margin:0 0 24px;padding-left:20px;color:#6b7280;font-size:14px;line-height:2;">
            <li>Go to your dashboard</li>
            <li>Click <strong style="color:#374151;">Discover</strong></li>
            <li>Pick a niche → choose a product → hit generate</li>
          </ol>
          <p style="margin:0 0 16px;">${btn(`${appUrl}/dashboard`, "Create my first product →")}</p>
          <p style="margin:0 0 28px;text-align:center;">
            <a href="https://www.skool.com/content-flywheel-7716" style="color:#f97316;font-size:14px;text-decoration:none;font-weight:500;">Join the free community →</a>
          </p>
          ${footer}
        `),
      });
      if (welcomeError) console.error("[Clerk webhook] Welcome email failed:", welcomeError);

      // ── Day 2: Have you started yet? ────────────────────────────────────────
      // Note: scheduledAt requires Resend Pro plan
      const day2At = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Have you created your first product yet?",
        scheduledAt: day2At,
        html: emailCard(`
          <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">You signed up 2 days ago — just checking in. Have you created your first digital product yet?</p>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">If not, it takes less than 5 minutes. Go to <strong style="color:#374151;">Discover</strong>, pick any niche you know something about — personal finance, fitness, productivity, side hustles — and let the AI do the rest.</p>
          <p style="margin:0 0 8px;color:#374151;font-size:15px;font-weight:600;">You can create:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#6b7280;font-size:14px;line-height:2;">
            <li>Ebooks &amp; guides</li>
            <li>Planners &amp; journals</li>
            <li>Checklists &amp; workbooks</li>
            <li>Templates &amp; Notion docs</li>
          </ul>
          <p style="margin:0 0 28px;">${btn(`${appUrl}/dashboard/digital-products/discover`, "Create my first product →")}</p>
          ${footer}
        `),
      }).catch((e) => console.error("[Clerk webhook] Day 2 email failed:", e));

      // ── Day 4: Expertise field tip ───────────────────────────────────────────
      const day4At = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
      resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "This makes your content sound like YOU (not a robot)",
        scheduledAt: day4At,
        html: emailCard(`
          <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">Most AI tools produce content that sounds the same. Generic. Template-y. You can tell it was written by a machine.</p>
          <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">Content Flywheel has a field called <strong style="color:#374151;">"Your expertise or unique angle"</strong> — when you fill this in, the AI writes from your perspective instead of a blank slate.</p>
          <div style="margin:0 0 24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;">
            <p style="margin:0 0 6px;color:#9a3412;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Example</p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;font-style:italic;">"I've paid off £12k of debt in 18 months using this exact method. I discovered that most budgeting advice is overcomplicated — so I stripped it back to 3 rules."</p>
          </div>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.7;">You'll find it in the Create flow and in Step 7 of the Discover wizard. Try it on your next product — the difference is noticeable.</p>
          <p style="margin:0 0 28px;">${btn(`${appUrl}/dashboard/digital-products`, "Try it now →")}</p>
          ${footer}
        `),
      }).catch((e) => console.error("[Clerk webhook] Day 4 email failed:", e));

      // ── Day 6: Trial ending tomorrow ─────────────────────────────────────────
      const day6At = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
      resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Your free trial ends tomorrow",
        scheduledAt: day6At,
        html: emailCard(`
          <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">Your 7-day free trial ends tomorrow. After that, you'll need to upgrade to keep creating and marketing digital products.</p>
          <p style="margin:0 0 8px;color:#374151;font-size:15px;font-weight:600;">What you keep with a paid plan:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#6b7280;font-size:14px;line-height:2;">
            <li>Unlimited digital product creation</li>
            <li>AI marketing content (hooks, scripts, captions)</li>
            <li>Access to the free Skool community</li>
            <li>All future features</li>
          </ul>
          <div style="margin:0 0 24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;text-align:center;">
            <p style="margin:0 0 4px;color:#9a3412;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Plans from</p>
            <p style="margin:0;color:#f97316;font-size:32px;font-weight:800;line-height:1;">£19<span style="font-size:16px;font-weight:500;">/mo</span></p>
            <p style="margin:4px 0 0;color:#9a3412;font-size:13px;">Annual plan &mdash; cancel anytime</p>
          </div>
          <p style="margin:0 0 28px;">${btn(`${appUrl}/pricing`, "Upgrade now →")}</p>
          ${footer}
        `),
      }).catch((e) => console.error("[Clerk webhook] Day 6 email failed:", e));

    } else if (!email) {
      console.warn("[Clerk webhook] user.created: no email to send welcome to");
    }
  }

  return NextResponse.json({ received: true });
}
