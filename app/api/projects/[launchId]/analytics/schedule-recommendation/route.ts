/**
 * POST /api/projects/[launchId]/analytics/schedule-recommendation
 * ──────────────────────────────────────────────────────────────────────────────
 * AI-powered schedule recommendation for a piece of content.
 *
 * Body: { content: string, managerId: MarketingManagerId }
 * Returns: ScheduleRecommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, MarketingManagerId } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { getScheduleRecommendation } from "@/lib/smart-scheduler";

export const maxDuration = 30;

const VALID_IDS = new Set<MarketingManagerId>([
  "tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const { content, managerId } = await req.json().catch(() => ({})) as {
    content?:   string;
    managerId?: string;
  };

  if (!content || !managerId || !VALID_IDS.has(managerId as MarketingManagerId)) {
    return NextResponse.json({ error: "content and a valid managerId are required" }, { status: 400 });
  }

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const recommendation = await getScheduleRecommendation(content, managerId as MarketingManagerId, results);

  return NextResponse.json({ recommendation });
}
