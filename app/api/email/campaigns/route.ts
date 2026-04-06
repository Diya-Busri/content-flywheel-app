import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/is-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    if (!await isAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { subject, previewText, bodyHtml } = body;

    if (!subject || typeof subject !== "string") {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!bodyHtml || typeof bodyHtml !== "string") {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }

    const [campaign] = await db
      .insert(emailCampaignsTable)
      .values({
        userId,
        subject: subject.trim(),
        previewText: previewText ? String(previewText).trim() : null,
        bodyHtml: bodyHtml.trim(),
        status: "draft",
      })
      .returning();

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("Email campaigns POST error:", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
