export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/intelligence/dashboard
 *
 * Returns full intelligence dashboard data for the authenticated user:
 * - Knowledge score, memory counts, patterns, recommendations, timeline
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDashboardData } from "@/lib/intelligence-engine";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getDashboardData(userId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[intelligence/dashboard]", err);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
