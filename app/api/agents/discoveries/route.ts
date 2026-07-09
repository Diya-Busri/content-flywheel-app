export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/agents/discoveries  — list undismissed discoveries (optionally filtered)
 * PUT /api/agents/discoveries  { id } — dismiss a discovery
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { agentDiscoveriesTable } from "@/db/schema/agent-discoveries-schema";
import { eq, and, desc, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const agentType = searchParams.get("agentType");
    const daysBack = parseInt(searchParams.get("daysBack") ?? "7", 10);
    const includeDismissed = searchParams.get("includeDismissed") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

    const cutoff = new Date(Date.now() - daysBack * 86_400_000);

    const conditions = [
      eq(agentDiscoveriesTable.userId, userId),
      gte(agentDiscoveriesTable.createdAt, cutoff),
    ];
    if (!includeDismissed) conditions.push(eq(agentDiscoveriesTable.isDismissed, false));
    if (agentType) conditions.push(eq(agentDiscoveriesTable.agentType, agentType));

    const rows = await db
      .select()
      .from(agentDiscoveriesTable)
      .where(and(...conditions))
      .orderBy(desc(agentDiscoveriesTable.priority), desc(agentDiscoveriesTable.createdAt))
      .limit(limit);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[agents/discoveries GET]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db
      .update(agentDiscoveriesTable)
      .set({ isDismissed: true })
      .where(and(
        eq(agentDiscoveriesTable.id, body.id),
        eq(agentDiscoveriesTable.userId, userId),
      ));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agents/discoveries PUT]", err);
    return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
  }
}
