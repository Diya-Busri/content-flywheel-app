export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET    /api/business-goals           — list active goals
 * POST   /api/business-goals           — create goal
 * PUT    /api/business-goals           — update goal (current progress, title, target, etc.)
 * DELETE /api/business-goals?id=...   — soft-delete (set is_active = false)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { businessGoalsTable } from "@/db/schema/business-goals-schema";
import { eq, and, desc } from "drizzle-orm";

const VALID_TYPES = ["revenue", "products", "content", "followers", "email_list", "experiments", "custom"];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(businessGoalsTable)
      .where(and(eq(businessGoalsTable.userId, userId), eq(businessGoalsTable.isActive, true)))
      .orderBy(desc(businessGoalsTable.createdAt));
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[business-goals GET]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as {
      goalType?: string; title?: string; target?: number;
      current?: number; unit?: string; deadline?: string;
    };

    if (!body.goalType || !body.title || typeof body.target !== "number") {
      return NextResponse.json({ error: "goalType, title, and target are required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(body.goalType)) {
      return NextResponse.json({ error: "Invalid goalType" }, { status: 400 });
    }

    const rows = await db.insert(businessGoalsTable).values({
      userId,
      goalType: body.goalType,
      title: body.title,
      target: body.target,
      current: body.current ?? 0,
      unit: body.unit ?? "",
      deadline: body.deadline ? new Date(body.deadline) : null,
    }).returning();

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[business-goals POST]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as {
      id?: string; title?: string; target?: number;
      current?: number; unit?: string; deadline?: string;
    };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Partial<typeof businessGoalsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updates.title = body.title;
    if (typeof body.target === "number") updates.target = body.target;
    if (typeof body.current === "number") updates.current = body.current;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.deadline !== undefined) updates.deadline = body.deadline ? new Date(body.deadline) : null;

    await db.update(businessGoalsTable)
      .set(updates)
      .where(and(eq(businessGoalsTable.id, body.id), eq(businessGoalsTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[business-goals PUT]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.update(businessGoalsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(businessGoalsTable.id, id), eq(businessGoalsTable.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[business-goals DELETE]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
