import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = params;

    const [campaign] = await db
      .select()
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (err) {
    console.error("Email campaign GET error:", err);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = params;
    const body = await request.json();
    const { subject, previewText, bodyHtml } = body;

    // Only allow editing drafts
    const [existing] = await db
      .select({ status: emailCampaignsTable.status })
      .from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Only draft campaigns can be edited" }, { status: 400 });
    }

    const updateData: Partial<{ subject: string; previewText: string | null; bodyHtml: string }> = {};
    if (subject !== undefined) updateData.subject = String(subject).trim();
    if (previewText !== undefined) updateData.previewText = previewText ? String(previewText).trim() : null;
    if (bodyHtml !== undefined) updateData.bodyHtml = String(bodyHtml).trim();

    const [updated] = await db
      .update(emailCampaignsTable)
      .set(updateData)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Email campaign PUT error:", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = params;

    const deleted = await db
      .delete(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.userId, userId)))
      .returning({ id: emailCampaignsTable.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email campaign DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
