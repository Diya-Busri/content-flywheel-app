import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await db
      .select()
      .from(emailCampaignsTable)
      .where(eq(emailCampaignsTable.userId, userId))
      .orderBy(desc(emailCampaignsTable.createdAt));

    return NextResponse.json(campaigns);
  } catch (err) {
    console.error("Email campaigns GET error:", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { subject, previewText, bodyHtml, scheduledFor } = body;

    if (!subject || typeof subject !== "string") {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!bodyHtml || typeof bodyHtml !== "string") {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduled = scheduledDate && !isNaN(scheduledDate.getTime()) && scheduledDate > new Date();

    const [campaign] = await db
      .insert(emailCampaignsTable)
      .values({
        userId,
        subject: subject.trim(),
        previewText: previewText ? String(previewText).trim() : null,
        bodyHtml: bodyHtml.trim(),
        status: isScheduled ? "scheduled" : "draft",
        scheduledFor: scheduledDate ?? undefined,
      })
      .returning();

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("Email campaigns POST error:", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
