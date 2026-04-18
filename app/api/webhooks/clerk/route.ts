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
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Welcome to Content Flywheel",
        html: `
          <p>Hi ${name.replace(/</g, "&lt;")},</p>
          <p>Thanks for signing up for Content Flywheel. You can start creating digital products, AI voiceovers, and conversion-focused videos from your dashboard.</p>
          <p><a href="https://contentflywheel.co.uk/dashboard">Go to your dashboard</a></p>
          <p>If you have any questions, just reply to this email or use the chat on the site.</p>
          <p>— The Content Flywheel team</p>
        `,
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
