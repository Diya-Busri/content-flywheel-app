import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailCampaignsTable, emailContactsTable } from "@/db/schema/email-marketing-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productWaitlistsTable } from "@/db/schema/product-waitlists-schema";
import { waitlistEntriesTable } from "@/db/schema/bio-page-schema";
import { eq, and, isNull } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;

    // Optional tag filter from request body (overrides campaign-level audienceTag)
    const body = await request.json().catch(() => ({}));
    const tagFilter: string | null = typeof body.tagFilter === "string" && body.tagFilter.trim()
      ? body.tagFilter.trim()
      : null;

    // Fetch the campaign
    const [campaign] = await db
      .select()
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch brand name for the from address (table may not exist yet)
    let fromName = "Content Flywheel";
    try {
      const [bv] = await db
        .select({ brandName: brandVoiceTable.brandName })
        .from(brandVoiceTable)
        .where(eq(brandVoiceTable.userId, userId))
        .limit(1);
      if (bv?.brandName?.trim()) fromName = bv.brandName.trim();
    } catch { /* brand_voice table not yet created — use default */ }
    const fromEmail = process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1]
      ?? process.env.RESEND_FROM_EMAIL
      ?? "hello@contentflywheel.co.uk";
    const from = `${fromName} <${fromEmail}>`;

    // Build batch messages, chunked at 100 per Resend batch limits
    const BATCH_SIZE = 100;
    let totalSent = 0;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

    const buildEmailHtml = (contact: { id: string; name: string | null }, bodyHtml: string) => {
      const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?id=${contact.id}`;
      const trackingPixel = `<img src="${baseUrl}/api/email/track?c=${campaign.id}" width="1" height="1" style="display:block;border:0;" alt="" />`;
      // Convert plain-text newlines to HTML paragraphs if no HTML tags present
      const formattedBody = bodyHtml.includes("<")
        ? bodyHtml
        : bodyHtml
            .split(/\n\n+/)
            .map((para) => `<p style="margin:0 0 16px 0;">${para.replace(/\n/g, "<br/>")}</p>`)
            .join("");
      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
            <img src="https://contentflywheel.co.uk/logo.png" alt="${fromName}" width="130" style="display:inline-block;height:auto;" />
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">
            ${formattedBody}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F5C97A;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#0B0B0F;font-weight:600;">${fromName}</p>
            <p style="margin:0;font-size:12px;color:#0B0B0F80;">
              You received this because you subscribed to updates from this creator.<br/>
              <a href="${unsubscribeUrl}" style="color:#0B0B0F;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
      ${trackingPixel}
    </td></tr>
  </table>
</body>
</html>`;
    };

    // Resolve effective audience tag (body override takes priority over campaign field)
    const effectiveTag = tagFilter ?? (campaign as { audienceTag?: string | null }).audienceTag ?? null;
    const specificEmail = (campaign as { specificEmail?: string | null }).specificEmail ?? null;

    // If campaign targets a specific email, bypass contacts table
    if (specificEmail) {
      const html = buildEmailHtml({ id: campaign.id, name: null }, campaign.bodyHtml);
      await resend.emails.send({ from, to: specificEmail, subject: campaign.subject, html });
      await db
        .update(emailCampaignsTable)
        .set({ status: "sent", sentAt: new Date(), recipientCount: 1 })
        .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)));
      return NextResponse.json({ success: true, sent: 1 });
    }

    // ── Buyer audience (product_orders) ──────────────────────────────────
    if (effectiveTag?.startsWith("buyers:")) {
      const productId = effectiveTag.slice("buyers:".length); // "all" or a UUID
      const orderRows = await db
        .select({ buyerEmail: productOrdersTable.buyerEmail, buyerName: productOrdersTable.buyerName, id: productOrdersTable.id })
        .from(productOrdersTable)
        .where(
          and(
            eq(productOrdersTable.creatorUserId, userId),
            eq(productOrdersTable.status, "completed"),
            ...(productId !== "all" ? [eq(productOrdersTable.productId, productId as string)] : [])
          )
        );

      // Deduplicate by email
      const seen = new Set<string>();
      const buyers = orderRows.filter((r) => {
        if (seen.has(r.buyerEmail)) return false;
        seen.add(r.buyerEmail);
        return true;
      });

      if (buyers.length === 0) {
        return NextResponse.json({ error: "No customers found for this product yet" }, { status: 400 });
      }

      for (let i = 0; i < buyers.length; i += BATCH_SIZE) {
        const chunk = buyers.slice(i, i + BATCH_SIZE);
        const messages = chunk.map((b) => ({
          from,
          to: b.buyerEmail,
          subject: campaign.subject,
          html: buildEmailHtml({ id: b.id, name: b.buyerName ?? null }, campaign.bodyHtml),
        }));
        await resend.batch.send(messages);
        totalSent += chunk.length;
      }

      await db.update(emailCampaignsTable)
        .set({ status: "sent", sentAt: new Date(), recipientCount: totalSent })
        .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)));
      return NextResponse.json({ success: true, sent: totalSent });
    }

    // ── Product waitlist audience ─────────────────────────────────────────
    if (effectiveTag === "waitlist:all" || effectiveTag?.startsWith("waitlist:")) {
      const productId = effectiveTag === "waitlist:all" ? null : effectiveTag.slice("waitlist:".length);
      const rows = await db
        .select({ email: productWaitlistsTable.email, name: productWaitlistsTable.name, id: productWaitlistsTable.id })
        .from(productWaitlistsTable)
        .where(
          and(
            eq(productWaitlistsTable.creatorUserId, userId),
            ...(productId ? [eq(productWaitlistsTable.productId, productId)] : [])
          )
        );

      const seen = new Set<string>();
      const recipients = rows.filter((r) => { if (seen.has(r.email)) return false; seen.add(r.email); return true; });
      if (recipients.length === 0) return NextResponse.json({ error: "No waitlist subscribers found" }, { status: 400 });

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        await resend.batch.send(chunk.map((r) => ({ from, to: r.email, subject: campaign.subject, html: buildEmailHtml({ id: r.id, name: r.name ?? null }, campaign.bodyHtml) })));
        totalSent += chunk.length;
      }
      await db.update(emailCampaignsTable).set({ status: "sent", sentAt: new Date(), recipientCount: totalSent }).where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)));
      return NextResponse.json({ success: true, sent: totalSent });
    }

    // ── Bio page waitlist audience ────────────────────────────────────────
    if (effectiveTag === "bio_waitlist:all") {
      const rows = await db
        .select({ email: waitlistEntriesTable.email, name: waitlistEntriesTable.name, id: waitlistEntriesTable.id })
        .from(waitlistEntriesTable)
        .where(eq(waitlistEntriesTable.userId, userId));

      const seen = new Set<string>();
      const recipients = rows.filter((r) => { if (seen.has(r.email)) return false; seen.add(r.email); return true; });
      if (recipients.length === 0) return NextResponse.json({ error: "No bio page subscribers found" }, { status: 400 });

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        await resend.batch.send(chunk.map((r) => ({ from, to: r.email, subject: campaign.subject, html: buildEmailHtml({ id: r.id, name: r.name ?? null }, campaign.bodyHtml) })));
        totalSent += chunk.length;
      }
      await db.update(emailCampaignsTable).set({ status: "sent", sentAt: new Date(), recipientCount: totalSent }).where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)));
      return NextResponse.json({ success: true, sent: totalSent });
    }

    // Fetch all subscribed contacts (not unsubscribed)
    let contacts = await db
      .select({ id: emailContactsTable.id, email: emailContactsTable.email, name: emailContactsTable.name, tags: emailContactsTable.tags })
      .from(emailContactsTable)
      .where(and(eq(emailContactsTable.userId, userId), isNull(emailContactsTable.unsubscribedAt)));

    // Apply tag filter if requested
    if (effectiveTag) {
      contacts = contacts.filter((c) => c.tags.includes(effectiveTag));
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: "No active contacts to send to" }, { status: 400 });
    }

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const chunk = contacts.slice(i, i + BATCH_SIZE);
      const messages = chunk.map((contact) => ({
        from,
        to: contact.email,
        subject: campaign.subject,
        ...(campaign.previewText ? { text: campaign.previewText } : {}),
        html: buildEmailHtml(contact, campaign.bodyHtml),
      }));

      await resend.batch.send(messages);
      totalSent += chunk.length;
    }

    // Update campaign status
    await db
      .update(emailCampaignsTable)
      .set({
        status: "sent",
        sentAt: new Date(),
        recipientCount: totalSent,
      })
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)));

    return NextResponse.json({ success: true, sent: totalSent });
  } catch (err) {
    console.error("Email campaign send error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to send campaign", detail: msg }, { status: 500 });
  }
}
