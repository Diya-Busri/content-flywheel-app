import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailCampaignsTable, emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq, and, isNull } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;

    // Fetch the campaign
    const [campaign] = await db
      .select()
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch all subscribed contacts (not unsubscribed)
    const contacts = await db
      .select({ email: emailContactsTable.email, name: emailContactsTable.name })
      .from(emailContactsTable)
      .where(and(eq(emailContactsTable.userId, userId), isNull(emailContactsTable.unsubscribedAt)));

    if (contacts.length === 0) {
      return NextResponse.json({ error: "No active contacts to send to" }, { status: 400 });
    }

    // Build batch messages, chunked at 100 per Resend batch limits
    const BATCH_SIZE = 100;
    let totalSent = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const chunk = contacts.slice(i, i + BATCH_SIZE);
      const messages = chunk.map((contact) => ({
        from: "Content Flywheel <onboarding@resend.dev>",
        to: contact.email,
        subject: campaign.subject,
        ...(campaign.previewText ? { text: campaign.previewText } : {}),
        html: campaign.bodyHtml,
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
    return NextResponse.json({ error: "Failed to send campaign" }, { status: 500 });
  }
}
