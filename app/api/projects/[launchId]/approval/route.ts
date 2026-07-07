/**
 * GET   /api/projects/[launchId]/approval          — list approval inbox
 * PATCH /api/projects/[launchId]/approval           — approve/reject items
 *
 * PATCH body: { action: "approve" | "reject" | "approve_all" | "reject_all", ids?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import type { ApprovalItem } from "@/db/schema/launch-schema";

export const dynamic = "force-dynamic";

async function getProject(launchId: string, userId: string) {
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));
  return project ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.launchId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = (project.stageResults ?? {}) as Record<string, unknown>;
  const inbox   = (results.approvalInbox ?? []) as ApprovalItem[];

  // Optional filter by status
  const url    = new URL(req.url);
  const status = url.searchParams.get("status"); // "pending" | "approved" | "rejected"
  const items  = status ? inbox.filter(i => i.status === status) : inbox;

  return NextResponse.json({
    items,
    counts: {
      pending:  inbox.filter(i => i.status === "pending").length,
      approved: inbox.filter(i => i.status === "approved").length,
      rejected: inbox.filter(i => i.status === "rejected").length,
      total:    inbox.length,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { launchId: string } },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.launchId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    action: "approve" | "reject" | "approve_all" | "reject_all";
    ids?:   string[];
  };

  const results = (project.stageResults ?? {}) as Record<string, unknown>;
  let   inbox   = (results.approvalInbox ?? []) as ApprovalItem[];
  const reviewedAt = new Date().toISOString();

  switch (body.action) {
    case "approve_all":
      inbox = inbox.map(i =>
        i.status === "pending" ? { ...i, status: "approved", reviewedAt } : i,
      );
      break;
    case "reject_all":
      inbox = inbox.map(i =>
        i.status === "pending" ? { ...i, status: "rejected", reviewedAt } : i,
      );
      break;
    case "approve":
      inbox = inbox.map(i =>
        body.ids?.includes(i.id) ? { ...i, status: "approved", reviewedAt } : i,
      );
      break;
    case "reject":
      inbox = inbox.map(i =>
        body.ids?.includes(i.id) ? { ...i, status: "rejected", reviewedAt } : i,
      );
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: {
        ...results,
        approvalInbox: inbox,
      } as unknown as typeof launchProjectsTable.$inferInsert["stageResults"],
    })
    .where(and(eq(launchProjectsTable.id, params.launchId), eq(launchProjectsTable.userId, userId)));

  return NextResponse.json({
    items: inbox,
    counts: {
      pending:  inbox.filter(i => i.status === "pending").length,
      approved: inbox.filter(i => i.status === "approved").length,
      rejected: inbox.filter(i => i.status === "rejected").length,
      total:    inbox.length,
    },
  });
}
