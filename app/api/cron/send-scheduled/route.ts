import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailCampaignsTable, emailContactsTable } from "@/db/schema/email-marketing-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { scheduledBlastsTable } from "@/db/schema/scheduled-blasts-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
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
      // Fetch brand name
      const [bv] = await db
        .select({ brandName: brandVoiceTable.brandName })
        .from(brandVoiceTable)
        .where(eq(brandVoiceTable.userId, campaign.userId))
        .limit(1);
      const fromName = bv?.brandName?.trim() || "Content Flywheel";
      const from = `${fromName} <hello@contentflywheel.co.uk>`;

      // Fetch subscribed contacts
      const contacts = await db
        .select({ id: emailContactsTable.id, email: emailContactsTable.email })
        .from(emailContactsTable)
        .where(
          and(
            eq(emailContactsTable.userId, campaign.userId),
            isNull(emailContactsTable.unsubscribedAt)
          )
        );

      if (contacts.length === 0) {
        await db
          .update(emailCampaignsTable)
          .set({ status: "sent", sentAt: now, recipientCount: 0 })
          .where(eq(emailCampaignsTable.id, campaign.id));
        continue;
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
      const BATCH_SIZE = 100;
      let sent = 0;

      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const chunk = contacts.slice(i, i + BATCH_SIZE);
        const messages = chunk.map((contact) => {
          const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?id=${contact.id}`;
          const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">You received this email because you subscribed to updates from this creator.<br/><a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></div>`;
          return {
            from,
            to: contact.email,
            subject: campaign.subject,
            ...(campaign.previewText ? { text: campaign.previewText } : {}),
            html: campaign.bodyHtml + footer,
          };
        });
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
