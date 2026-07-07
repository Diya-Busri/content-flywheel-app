export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/opportunity-radar  — unified, scored opportunity feed
 * PUT /api/opportunity-radar  { id, source } — dismiss a signal
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { agentDiscoveriesTable } from "@/db/schema/agent-discoveries-schema";
import { userRecommendationsTable } from "@/db/schema/user-recommendations-schema";
import { eq, and } from "drizzle-orm";
import { getOpportunityRadar } from "@/lib/opportunity-radar";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 60);
    const signals = await getOpportunityRadar(userId, limit);
    return NextResponse.json(signals);
  } catch (err) {
    console.error("[opportunity-radar GET]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { id?: string; source?: string };
    if (!body.id || !body.source) {
      return NextResponse.json({ error: "id and source required" }, { status: 400 });
    }

    if (body.source === "agent") {
      await db.update(agentDiscoveriesTable)
        .set({ isDismissed: true })
        .where(and(eq(agentDiscoveriesTable.id, body.id), eq(agentDiscoveriesTable.userId, userId)));
    } else if (body.source === "intelligence") {
      await db.update(userRecommendationsTable)
        .set({ isDismissed: true })
        .where(and(eq(userRecommendationsTable.id, body.id), eq(userRecommendationsTable.userId, userId)));
    }
    // Patterns can't be dismissed (canDismiss: false)

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[opportunity-radar PUT]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
