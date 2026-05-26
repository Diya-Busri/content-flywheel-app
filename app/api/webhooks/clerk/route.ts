import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";
import { createProfile, getProfileByUserId } from "@/db/queries/profiles-queries";
import { db } from "@/db/db";
import { videoCreditTransactionsTable } from "@/db/schema/video-credit-transactions-schema";
import { FREE_SIGNUP_CREDITS } from "@/lib/video-credits";

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

    // Create profile row for new user with free starter credits
    if (userId) {
      try {
        const existing = await getProfileByUserId(userId);
        if (!existing) {
          await createProfile({
            userId,
            email: email ?? undefined,
            membership: "free",
            videoCredits: FREE_SIGNUP_CREDITS,
          });
          // Log the welcome credit grant as a transaction
          await db.insert(videoCreditTransactionsTable).values({
            userId,
            type: "purchase",
            amount: FREE_SIGNUP_CREDITS,
            description: "🎁 Welcome credits — free on signup",
          }).catch((e) => console.error("[Clerk webhook] Failed to log welcome credits transaction:", e));
          console.log(`[Clerk webhook] Created profile + granted ${FREE_SIGNUP_CREDITS} free credits for ${userId}`);
        }
      } catch (err) {
        console.error("[Clerk webhook] Failed to create profile:", err);
      }
    }

    if (!RESEND_API_KEY) {
      console.error("[Clerk webhook] RESEND_API_KEY is not set — welcome email skipped");
    }

    if (RESEND_API_KEY && email) {
      const resend = new Resend(RESEND_API_KEY);
      const firstName = (data.first_name?.trim() || "there").replace(/</g, "&lt;");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Welcome to Content Flywheel 👋",
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Content Flywheel</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">Content Flywheel</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
              <p style="margin:0 0 8px;color:#374151;font-size:16px;line-height:1.6;">Welcome to Content Flywheel!</p>
              <div style="margin:0 0 24px;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;text-align:center;">
                <p style="margin:0 0 4px;color:#9a3412;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your free credits</p>
                <p style="margin:0;color:#f97316;font-size:36px;font-weight:800;line-height:1;">100</p>
                <p style="margin:4px 0 0;color:#9a3412;font-size:13px;">ready to use &mdash; no card required</p>
              </div>
              <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">Use your credits to generate AI videos, design products, and start selling &mdash; all from one dashboard.</p>
              <p style="margin:0 0 6px;color:#374151;font-size:14px;font-weight:600;">What 100 credits gets you:</p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#6b7280;font-size:14px;line-height:1.9;">
                <li>10 AI video generations (Brand Story, TikTok Shop, Cooking)</li>
                <li>10 AI design generations (Print on Demand)</li>
                <li>5 UGC avatar videos</li>
              </ul>
              <p style="margin:0 0 12px;">
                <a href="${appUrl}/dashboard" style="display:inline-block;width:100%;max-width:100%;padding:14px 28px;background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;text-align:center;box-sizing:border-box;">Use my free credits &rarr;</a>
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="https://www.skool.com/content-flywheel-7716" style="color:#f97316;font-size:14px;text-decoration:none;font-weight:500;">Join the free community &rarr;</a>
              </p>
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />
              <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">&mdash; The Content Flywheel Team</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#d1d5db;font-size:12px;">Powered by <strong style="color:#f97316;">Content Flywheel</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
      if (error) {
        console.error("[Clerk webhook] Resend failed:", error);
      }
    } else if (!email) {
      console.warn("[Clerk webhook] user.created: no email to send welcome to");
    }
  }

  return NextResponse.json({ received: true });
}
