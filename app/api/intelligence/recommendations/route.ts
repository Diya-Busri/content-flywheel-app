export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET  /api/intelligence/recommendations  — list undismissed recommendations
 * PUT  /api/intelligence/recommendations  { id } — dismiss a recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userRecommendationsTable } from "@/db/schema/user-recommendations-schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(userRecommendationsTable)
      .where(and(
        eq(userRecommendationsTable.userId, userId),
        eq(userRecommendationsTable.isDismissed, false)
      ))
      .orderBy(desc(userRecommendationsTable.priority))
      .limit(10);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[intelligence/recommendations GET]", err);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db
      .update(userRecommendationsTable)
      .set({ isDismissed: true })
      .where(and(
        eq(userRecommendationsTable.id, body.id),
        eq(userRecommendationsTable.userId, userId)
      ));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[intelligence/recommendations PUT]", err);
    return NextResponse.json({ error: "Failed to dismiss recommendation" }, { status: 500 });
  }
}
