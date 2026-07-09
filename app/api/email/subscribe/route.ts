import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { emailAutomationsTable } from "@/db/schema/email-automations-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { creatorEmailSettingsTable } from "@/db/schema/creator-email-settings-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";
import { notificationsTable } from "@/db/schema/notifications-schema";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildWelcomeHtml(creatorName: string | null): string {
  const displayName = creatorName ?? "our newsletter";
  const greeting = creatorName
    ? `Thanks for subscribing to <strong>${creatorName}</strong>!`
    : "Thanks for subscribing to our newsletter!";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're subscribed!</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header band -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:36px;">🎉</p>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
                You&rsquo;re subscribed!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                ${greeting}
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.7;">
                You&rsquo;ll receive updates, offers, and exclusive content directly to your inbox. We&rsquo;re really glad to have you here.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />

              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
                If you ever change your mind, you can
                <a href="https://contentflywheel.com/unsubscribe" style="color:#f97316;text-decoration:underline;">unsubscribe here</a>
                at any time.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#d1d5db;font-size:12px;">
                Powered by <strong style="color:#f97316;">Content Flywheel</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, userId } = body;

    // --- Validate inputs ---
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // --- Check userId exists in profiles ---
    const profiles = await db
      .select({ userId: profilesTable.userId, email: profilesTable.email })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const creatorProfile = profiles[0];

    // --- Check for duplicate ---
    const existing = await db
      .select({ id: emailContactsTable.id })
      .from(emailContactsTable)
      .where(
        and(
          eq(emailContactsTable.userId, userId),
          eq(emailContactsTable.email, email.toLowerCase().trim())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You are already subscribed!" },
        { status: 409 }
      );
    }

    // --- Insert contact ---
    await db.insert(emailContactsTable).values({
      userId,
      email: email.toLowerCase().trim(),
      name: name ? String(name).trim() : null,
      tags: [],
    });

    // --- Write in-app notification for creator ---
    try {
      await db.insert(notificationsTable).values({
        userId,
        title: "New subscriber",
        message: `${name ? `${name} (${email})` : email} just joined your email list`,
        type: "info",
        read: false,
        linkUrl: "/dashboard/store?tab=email",
        metadata: { kind: "subscriber", email, name: name ?? null },
      });
    } catch { /* non-fatal */ }

    // --- Send welcome email via Resend ---
    // Fetch creator's brand name and check for custom welcome automation.
    let creatorName: string | null = null;
    try {
      const [bv] = await db
        .select({ brandName: brandVoiceTable.brandName })
        .from(brandVoiceTable)
        .where(eq(brandVoiceTable.userId, userId))
        .limit(1);
      creatorName = bv?.brandName?.trim() || null;
    } catch {
      // Non-fatal — fall back to generic copy
    }

    // Check if creator has a custom welcome automation enabled
    let customWelcome: { subject: string; bodyHtml: string } | null = null;
    try {
      const [automation] = await db
        .select({ subject: emailAutomationsTable.subject, bodyHtml: emailAutomationsTable.bodyHtml })
        .from(emailAutomationsTable)
        .where(
          and(
            eq(emailAutomationsTable.userId, userId),
            eq(emailAutomationsTable.type, "welcome"),
            eq(emailAutomationsTable.enabled, true)
          )
        )
        .limit(1);
      if (automation) customWelcome = automation;
    } catch {
      // Non-fatal — fall back to default welcome
    }

    const fromName = creatorName ?? "Content Flywheel";
    const from = `${fromName} <hello@contentflywheel.co.uk>`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

    try {
      if (customWelcome) {
        // Use the creator's custom welcome email
        const formattedBody = customWelcome.bodyHtml.includes("<")
          ? customWelcome.bodyHtml
          : customWelcome.bodyHtml
              .split(/\n\n+/)
              .map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
              .join("");
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="https://contentflywheel.co.uk/logo.png" alt="${fromName}" width="130" style="display:inline-block;height:auto;"/>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">${formattedBody}</td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;color:#0B0B0F;font-weight:600;">${fromName}</p>
          <p style="margin:0;font-size:12px;color:#0B0B0F80;">
            You received this because you subscribed to updates from this creator.<br/>
            <a href="${baseUrl}/api/email/unsubscribe" style="color:#0B0B0F;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
        await resend.emails.send({ from, to: email.toLowerCase().trim(), subject: customWelcome.subject, html });
      } else {
        // Fall back to default welcome email
        await resend.emails.send({
          from,
          to: email.toLowerCase().trim(),
          subject: "You're subscribed! 🎉",
          html: buildWelcomeHtml(creatorName),
        });
      }
    } catch (emailErr) {
      // Log but don't fail the whole request — contact is already saved.
      console.error("Welcome email send error:", emailErr);
    }

    // --- Send lead magnet download if creator has one enabled ---
    try {
      const [emailSettings] = await db
        .select()
        .from(creatorEmailSettingsTable)
        .where(and(eq(creatorEmailSettingsTable.userId, userId), eq(creatorEmailSettingsTable.leadMagnetEnabled, true)))
        .limit(1);

      if (emailSettings?.leadMagnetProductId) {
        const [lmProduct] = await db
          .select({ id: productsTable.id, title: productsTable.title })
          .from(productsTable)
          .where(eq(productsTable.id, emailSettings.leadMagnetProductId))
          .limit(1);

        if (lmProduct) {
          const lmToken = crypto.randomUUID();
          const lmExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
          const lmDownloadUrl = `${appUrl}/api/products/${lmProduct.id}/download?token=${lmToken}`;

          // Store a free order record for the lead magnet
          const { productOrdersTable } = await import("@/db/schema/product-orders-schema");
          await db.insert(productOrdersTable).values({
            productId: lmProduct.id,
            creatorUserId: userId,
            buyerEmail: email.toLowerCase().trim(),
            buyerName: name ? String(name).trim() : null,
            amountCents: 0,
            currency: "gbp",
            stripeSessionId: `lead_magnet_${crypto.randomUUID()}`,
            status: "completed",
            downloadToken: lmToken,
            downloadExpiresAt: lmExpiry,
            emailSent: true,
          }).catch(() => {}); // ignore if fails (e.g. duplicate)

          await resend.emails.send({
            from,
            to: email.toLowerCase().trim(),
            subject: `Here's your free copy of "${lmProduct.title}" 🎁`,
            html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="https://contentflywheel.co.uk/logo.png" alt="${fromName}" width="130" style="display:inline-block;height:auto;"/>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">Here&apos;s your free gift! 🎁</h2>
          <p style="margin:0 0 16px;">As promised, here&apos;s your free copy of <strong>${lmProduct.title}</strong>.</p>
          <p style="margin:0 0 24px;">Click the button below to download it. The link is valid for 30 days.</p>
          <a href="${lmDownloadUrl}" style="display:inline-block;padding:14px 32px;background:#f97316;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">Download Your Freebie &rarr;</a>
        </td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#0B0B0F;font-weight:600;">${fromName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          });
        }
      }
    } catch (lmErr) {
      console.error("[subscribe] Lead magnet delivery error:", lmErr);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Subscribe POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
