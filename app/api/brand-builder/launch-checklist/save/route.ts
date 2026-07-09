import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { launchChecklistTable } from "@/db/schema/launch-checklist-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST: Save or update launch checklist progress (upsert by user_id).
 * Body: brandName, followerCount, podPlatform, sellingPlatform, stage,
 * milestone_to_launch, checklist, completed_tasks, waitlist_email, first_drop_pricing
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() || null : null;
    const followerCount = typeof body.followerCount === "string" ? body.followerCount.trim() || null : null;
    const podPlatform = typeof body.podPlatform === "string" ? body.podPlatform.trim() || null : null;
    const sellingPlatform = typeof body.sellingPlatform === "string" ? body.sellingPlatform.trim() || null : null;
    const stage = typeof body.stage === "string" ? body.stage.trim() || null : null;
    const milestoneToLaunch = typeof body.milestone_to_launch === "string" ? body.milestone_to_launch.trim() || null : null;
    const checklist = Array.isArray(body.checklist) ? body.checklist : null;
    const completedTasks = Array.isArray(body.completed_tasks) ? body.completed_tasks : [];
    const waitlistEmail = body.waitlist_email && typeof body.waitlist_email === "object" ? body.waitlist_email : null;
    const firstDropPricing = body.first_drop_pricing && typeof body.first_drop_pricing === "object" ? body.first_drop_pricing : null;

    const existing = await db.select().from(launchChecklistTable).where(eq(launchChecklistTable.userId, userId)).limit(1);

    const row = {
      brandName,
      followerCount,
      podPlatform,
      sellingPlatform,
      stage,
      milestoneToLaunch,
      checklist,
      completedTasks,
      waitlistEmail,
      firstDropPricing,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(launchChecklistTable)
        .set(row)
        .where(eq(launchChecklistTable.userId, userId))
        .returning();
      return NextResponse.json({ id: updated.id, updated: true });
    }

    const [inserted] = await db
      .insert(launchChecklistTable)
      .values({
        userId,
        ...row,
      })
      .returning();
    return NextResponse.json({ id: inserted.id, updated: false });
  } catch (e) {
    console.error("[brand-builder/launch-checklist/save]", e);
    return NextResponse.json({ error: "Failed to save progress." }, { status: 500 });
  }
}
