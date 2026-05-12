import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { createProfile, getProfileByUserId } from "@/db/queries/profiles-queries";

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

function getName(data: ClerkUserPayload): string {
  const first = data.first_name?.trim();
  const last = data.last_name?.trim();
  return [first, last].filter(Boolean).join(" ") || "there";
}

export async function POST(req: Request) {
  const rl = await checkApiRateLimit(getClientIp(req));
  if (rl) return rl;
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
    const name = getName(data);
    const userId = data.id;

    // Create profile row for new user
    if (userId) {
      try {
        const existing = await getProfileByUserId(userId);
        if (!existing) {
          await createProfile({ userId, email: email ?? undefined, membership: "free" });
          console.log(`[Clerk webhook] Created profile for new user ${userId}`);
        }
      } catch (err) {
        console.error("[Clerk webhook] Failed to create profile:", err);
      }
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
              <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">You&rsquo;re one step away from your content flywheel.</p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.7;">Content Flywheel lets you generate AI videos, create digital products, and sell &mdash; all from one dashboard. No 7-tool stack needed.</p>
              <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">Join our free community to see it in action:</p>
              <p style="margin:0 0 28px;">
                <a href="https://www.skool.com/content-flywheel-7716" style="display:inline-block;padding:12px 28px;background-color:#f97316;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Join the Community &rarr;</a>
              </p>
              <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">Then start your 7-day free trial:</p>
              <p style="margin:0 0 32px;">
                <a href="${appUrl}/dashboard" style="display:inline-block;padding:12px 28px;background-color:#0f172a;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Start my free trial &rarr;</a>
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
