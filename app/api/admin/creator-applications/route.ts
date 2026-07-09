/**
 * GET /api/admin/creator-applications
 * Returns all creator applications ordered newest first.
 * Admin-only.
 *
 * Query params:
 *   status?: "pending" | "accepted" | "waitlisted" | "rejected" | "all" (default: "all")
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq, desc } from "drizzle-orm";
import type { ApplicationStatus } from "@/db/schema/creator-applications-schema";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ApplicationStatus[] = ["pending", "accepted", "waitlisted", "rejected"];

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "all";

  try {
    const query = db
      .select()
      .from(creatorApplicationsTable)
      .orderBy(desc(creatorApplicationsTable.createdAt));

    let rows;
    if (VALID_STATUSES.includes(statusParam as ApplicationStatus)) {
      rows = await db
        .select()
        .from(creatorApplicationsTable)
        .where(eq(creatorApplicationsTable.status, statusParam as ApplicationStatus))
        .orderBy(desc(creatorApplicationsTable.createdAt));
    } else {
      rows = await query;
    }

    return NextResponse.json({ applications: rows });
  } catch (err) {
    console.error("[admin/creator-applications]", err);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
