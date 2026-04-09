import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailCampaignsTable, emailContactsTable } from "@/db/schema/email-marketing-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { scheduledBlastsTable } from "@/db/schema/scheduled-blasts-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, and, lte, isNull, gte, lt } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // Verify this is from Vercel Cron (or an authorised internal call)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all campaigns that are scheduled and due
  const dueCampaigns = await db
    .select()
    .from(emailCampaignsTable)
    .where(
      and(
        eq(emailCampaignsTable.status, "scheduled"),
        lte(emailCampaignsTable.scheduledFor, now)
      )
    );

  if (dueCampaigns.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let totalSent = 0;

  for (const campaign of dueCampaigns) {
    try {
      // Fetch brand name (table may not exist yet — fall back gracefully)
      let fromName = "Content Flywheel";
      try {
        const [bv] = await db
          .select({ brandName: brandVoiceTable.brandName })
          .from(brandVoiceTable)
          .where(eq(brandVoiceTable.userId, campaign.userId))
          .limit(1);
        if (bv?.brandName?.trim()) fromName = bv.brandName.trim();
      } catch { /* brand_voice table not yet created */ }
      const from = `${fromName} <hello@contentflywheel.co.uk>`;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
      const BATCH_SIZE = 100;
      let sent = 0;

      // If targeting a specific email, bypass contacts table
      const specificEmail = (campaign as { specificEmail?: string | null }).specificEmail ?? null;
      if (specificEmail) {
        const buildHtml = (contactId: string, body: string) => {
          const unsubUrl = `${baseUrl}/api/email/unsubscribe?id=${contactId}`;
          const formatted = body.includes("<") ? body : body.split(/\n\n+/).map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, "<br/>")}</p>`).join("");
          return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;"><tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;"><img src="https://contentflywheel.co.uk/logo.png" alt="${fromName}" width="130" style="height:auto;"/></td></tr><tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">${formatted}</td></tr><tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;"><p style="margin:0 0 6px;font-size:13px;color:#0B0B0F;font-weight:600;">${fromName}</p><p style="margin:0;font-size:12px;color:#0B0B0F80;">You received this because you subscribed to updates from this creator.<br/><a href="${unsubUrl}" style="color:#0B0B0F;text-decoration:underline;">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;
        };
        const resend2 = new Resend(process.env.RESEND_API_KEY);
        await resend2.emails.send({ from, to: specificEmail, subject: campaign.subject, html: buildHtml(campaign.id, campaign.bodyHtml) });
        await db.update(emailCampaignsTable).set({ status: "sent", sentAt: now, recipientCount: 1 }).where(eq(emailCampaignsTable.id, campaign.id));
        totalSent += 1;
        continue;
      }

      // Fetch subscribed contacts (including tags for audience filtering)
      const audienceTag = (campaign as { audienceTag?: string | null }).audienceTag ?? null;

      // ── Buyer audience ──────────────────────────────────────────────────
      if (audienceTag?.startsWith("buyers:")) {
        const productId = audienceTag.slice("buyers:".length);
        const orderRows = await db
          .select({ buyerEmail: productOrdersTable.buyerEmail, buyerName: productOrdersTable.buyerName, id: productOrdersTable.id })
          .from(productOrdersTable)
          .where(and(
            eq(productOrdersTable.creatorUserId, campaign.userId),
            eq(productOrdersTable.status, "completed"),
            ...(productId !== "all" ? [eq(productOrdersTable.productId, productId as string)] : [])
          ));
        const seen = new Set<string>();
        const buyers = orderRows.filter((r) => { if (seen.has(r.buyerEmail)) return false; seen.add(r.buyerEmail); return true; });
        if (buyers.length === 0) {
          await db.update(emailCampaignsTable).set({ status: "sent", sentAt: now, recipientCount: 0 }).where(eq(emailCampaignsTable.id, campaign.id));
          continue;
        }
        const batchSend = new Resend(process.env.RESEND_API_KEY);
        let bSent = 0;
        for (let i = 0; i < buyers.length; i += BATCH_SIZE) {
          const chunk = buyers.slice(i, i + BATCH_SIZE);
          const messages = chunk.map((b) => ({ from, to: b.buyerEmail, subject: campaign.subject, html: buildCampaignHtml(b.id, campaign.bodyHtml) }));
          await batchSend.batch.send(messages);
          bSent += chunk.length;
        }
        await db.update(emailCampaignsTable).set({ status: "sent", sentAt: now, recipientCount: bSent }).where(eq(emailCampaignsTable.id, campaign.id));
        totalSent += bSent;
        continue;
      }
      const allContacts = await db
        .select({ id: emailContactsTable.id, email: emailContactsTable.email, tags: emailContactsTable.tags })
        .from(emailContactsTable)
        .where(
          and(
            eq(emailContactsTable.userId, campaign.userId),
            isNull(emailContactsTable.unsubscribedAt)
          )
        );

      // Apply audience tag filter if set on campaign
      const contacts = audienceTag
        ? allContacts.filter((c) => c.tags.includes(audienceTag))
        : allContacts;

      if (contacts.length === 0) {
        await db
          .update(emailCampaignsTable)
          .set({ status: "sent", sentAt: now, recipientCount: 0 })
          .where(eq(emailCampaignsTable.id, campaign.id));
        continue;
      }

      const buildCampaignHtml = (contactId: string, bodyHtml: string) => {
        const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?id=${contactId}`;
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
        <tr>
          <td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
            <img src="https://contentflywheel.co.uk/logo.png" alt="${fromName}" width="130" style="display:inline-block;height:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">
            ${formattedBody}
          </td>
        </tr>
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
    </td></tr>
  </table>
</body>
</html>`;
      };

      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const chunk = contacts.slice(i, i + BATCH_SIZE);
        const messages = chunk.map((contact) => ({
          from,
          to: contact.email,
          subject: campaign.subject,
          ...(campaign.previewText ? { text: campaign.previewText } : {}),
          html: buildCampaignHtml(contact.id, campaign.bodyHtml),
        }));
        await resend.batch.send(messages);
        sent += chunk.length;
      }

      await db
        .update(emailCampaignsTable)
        .set({ status: "sent", sentAt: now, recipientCount: sent })
        .where(eq(emailCampaignsTable.id, campaign.id));

      totalSent += sent;
    } catch (err) {
      console.error(`[cron/send-scheduled] Failed for campaign ${campaign.id}:`, err);
    }
  }

  // ── Scheduled admin email blasts ──────────────────────────────────────────
  let blastsSent = 0;
  try {
    const dueBlasts = await db
      .select()
      .from(scheduledBlastsTable)
      .where(and(eq(scheduledBlastsTable.status, "pending"), lte(scheduledBlastsTable.scheduledFor, now)));

    for (const blast of dueBlasts) {
      try {
        let emails: string[] = [];

        if (blast.audience === "specific" && blast.targetEmail) {
          emails = [blast.targetEmail];
        } else {
          const day7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
          const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          let filter;
          if (blast.audience === "active_7d") {
            filter = and(eq(profilesTable.membership, "pro"), gte(profilesTable.lastActiveAt, day7));
          } else if (blast.audience === "active_30d") {
            filter = and(eq(profilesTable.membership, "pro"), gte(profilesTable.lastActiveAt, day30));
          } else if (blast.audience === "inactive_30d") {
            filter = and(eq(profilesTable.membership, "pro"), lt(profilesTable.lastActiveAt, day30), isNull(profilesTable.lastActiveAt));
          } else {
            filter = eq(profilesTable.membership, "pro");
          }
          const rows = await db.select({ email: profilesTable.email }).from(profilesTable).where(filter);
          emails = rows.map((r) => r.email).filter(Boolean) as string[];
        }

        const from = process.env.RESEND_FROM_EMAIL ?? "Content Flywheel <hello@contentflywheel.co.uk>";
        const BATCH = 50;
        let sent = 0;
        for (let i = 0; i < emails.length; i += BATCH) {
          const chunk = emails.slice(i, i + BATCH);
          await resend.emails.send({ from, to: chunk, subject: blast.subject, html: blast.htmlBody });
          sent += chunk.length;
        }

        await db.update(scheduledBlastsTable)
          .set({ status: "sent", sentAt: now, recipientCount: sent })
          .where(eq(scheduledBlastsTable.id, blast.id));

        blastsSent += sent;
      } catch (err) {
        console.error(`[cron] Scheduled blast ${blast.id} failed:`, err);
        await db.update(scheduledBlastsTable)
          .set({ status: "failed" })
          .where(eq(scheduledBlastsTable.id, blast.id));
      }
    }
  } catch (err) {
    console.error("[cron] Error processing scheduled blasts:", err);
  }

  return NextResponse.json({ sent: totalSent, campaigns: dueCampaigns.length, blastsSent });
}
