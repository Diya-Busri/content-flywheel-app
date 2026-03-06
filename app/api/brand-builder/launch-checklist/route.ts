import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { launchChecklistTable } from "@/db/schema/launch-checklist-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: Load current user's saved launch checklist (for "Load saved" or prefill).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const rows = await db
      .select()
      .from(launchChecklistTable)
      .where(eq(launchChecklistTable.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ saved: null });
    }

    const r = rows[0];
    return NextResponse.json({
      saved: {
        brandName: r.brandName ?? undefined,
        followerCount: r.followerCount ?? undefined,
        podPlatform: r.podPlatform ?? undefined,
        sellingPlatform: r.sellingPlatform ?? undefined,
        stage: r.stage ?? undefined,
        milestone_to_launch: r.milestoneToLaunch ?? undefined,
        checklist: r.checklist ?? [],
        completed_tasks: r.completedTasks ?? [],
        waitlist_email: r.waitlistEmail ?? undefined,
        first_drop_pricing: r.firstDropPricing ?? undefined,
      },
    });
  } catch (e) {
    console.error("[brand-builder/launch-checklist GET]", e);
    return NextResponse.json({ error: "Failed to load." }, { status: 500 });
  }
}
