import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { emailAutomationsTable } from "@/db/schema/email-automations-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/email/automations — fetch all automations for the logged-in creator
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const automations = await db
      .select()
      .from(emailAutomationsTable)
      .where(eq(emailAutomationsTable.userId, userId));

    return NextResponse.json(automations);
  } catch (err) {
    console.error("[email/automations] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
  }
}

// POST /api/email/automations — create or update an automation (upsert by userId + type)
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { type, subject, bodyHtml, enabled } = body;

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    if (typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "subject is required" }, { status: 400 });
    }
    if (typeof bodyHtml !== "string" || !bodyHtml.trim()) {
      return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
    }

    // Check if one already exists for this user+type
    const [existing] = await db
      .select({ id: emailAutomationsTable.id })
      .from(emailAutomationsTable)
      .where(and(eq(emailAutomationsTable.userId, userId), eq(emailAutomationsTable.type, type)))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(emailAutomationsTable)
        .set({ subject: subject.trim(), bodyHtml: bodyHtml.trim(), enabled: !!enabled, updatedAt: new Date() })
        .where(eq(emailAutomationsTable.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    } else {
      const [created] = await db
        .insert(emailAutomationsTable)
        .values({ userId, type, subject: subject.trim(), bodyHtml: bodyHtml.trim(), enabled: !!enabled })
        .returning();
      return NextResponse.json(created, { status: 201 });
    }
  } catch (err) {
    console.error("[email/automations] POST error:", err);
    return NextResponse.json({ error: "Failed to save automation" }, { status: 500 });
  }
}

// PATCH /api/email/automations — toggle enabled state only (quick toggle)
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { type, enabled } = await request.json();
    if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

    const [existing] = await db
      .select()
      .from(emailAutomationsTable)
      .where(and(eq(emailAutomationsTable.userId, userId), eq(emailAutomationsTable.type, type)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(emailAutomationsTable)
      .set({ enabled: !!enabled, updatedAt: new Date() })
      .where(eq(emailAutomationsTable.id, existing.id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[email/automations] PATCH error:", err);
    return NextResponse.json({ error: "Failed to toggle automation" }, { status: 500 });
  }
}
