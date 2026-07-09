export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/email/campaigns/[id]/test
 * Sends a single test email to the authenticated user's own email address.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;

    const [campaign] = await db
      .select()
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Get the user's own email
    const user = await currentUser();
    const toEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (!toEmail) return NextResponse.json({ error: "No email address found for your account" }, { status: 400 });

    // Use brand name as from-name if available
    const [bv] = await db
      .select({ brandName: brandVoiceTable.brandName })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1);
    const fromName = bv?.brandName?.trim() || "Content Flywheel";
    const from = `${fromName} <hello@contentflywheel.co.uk>`;

    const testFooter = `
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
        <strong>TEST EMAIL</strong> — This is a preview sent only to you.
      </div>`;

    await resend.emails.send({
      from,
      to: toEmail,
      subject: `[TEST] ${campaign.subject}`,
      html: campaign.bodyHtml + testFooter,
    });

    return NextResponse.json({ ok: true, sentTo: toEmail });
  } catch (err) {
    console.error("[campaigns/test]", err);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
