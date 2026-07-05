export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/agents/tasks  — list agent tasks (filtered by status)
 * PUT /api/agents/tasks  { id, status } — update task status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { agentTasksTable } from "@/db/schema/agent-tasks-schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);

    const rows = await db
      .select()
      .from(agentTasksTable)
      .where(and(
        eq(agentTasksTable.userId, userId),
        eq(agentTasksTable.status, status),
      ))
      .orderBy(desc(agentTasksTable.priority), desc(agentTasksTable.createdAt))
      .limit(limit);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[agents/tasks GET]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { id?: string; status?: string };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const validStatuses = ["pending", "completed", "dismissed"];
    const status = validStatuses.includes(body.status ?? "") ? body.status! : "completed";

    await db
      .update(agentTasksTable)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(agentTasksTable.id, body.id),
        eq(agentTasksTable.userId, userId),
      ));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agents/tasks PUT]", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
