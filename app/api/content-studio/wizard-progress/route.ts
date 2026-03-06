import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { contentStudioWizardProgressTable } from "@/db/schema/content-studio-wizard-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: Load video wizard progress for the current user.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [row] = await db
      .select()
      .from(contentStudioWizardProgressTable)
      .where(eq(contentStudioWizardProgressTable.userId, userId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        currentStep: row.currentStep,
        topics: row.topics ?? undefined,
        selectedNiche: row.selectedNiche ?? undefined,
        videoType: row.videoType ?? undefined,
        contentStyle: row.contentStyle ?? undefined,
        scriptStrategy: row.scriptStrategy ?? undefined,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error("[content-studio wizard-progress GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load progress" },
      { status: 500 }
    );
  }
}

/**
 * PUT: Save video wizard progress. Creates record if missing.
 * Body: { currentStep?, topics?, selectedNiche?, videoType?, contentStyle?, scriptStrategy? }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const currentStep = typeof body.currentStep === "number" && body.currentStep >= 1 && body.currentStep <= 7
      ? body.currentStep
      : undefined;
    const topics = typeof body.topics === "string" ? body.topics : undefined;
    const selectedNiche = typeof body.selectedNiche === "string" ? body.selectedNiche : undefined;
    const videoType = typeof body.videoType === "string" ? body.videoType : undefined;
    const contentStyle = typeof body.contentStyle === "string" ? body.contentStyle : undefined;
    const scriptStrategy = body.scriptStrategy != null && typeof body.scriptStrategy === "object" ? body.scriptStrategy : undefined;

    const payload = {
      userId,
      ...(currentStep != null && { currentStep }),
      ...(topics !== undefined && { topics }),
      ...(selectedNiche !== undefined && { selectedNiche }),
      ...(videoType !== undefined && { videoType }),
      ...(contentStyle !== undefined && { contentStyle }),
      ...(scriptStrategy !== undefined && { scriptStrategy: scriptStrategy as Record<string, unknown> }),
      updatedAt: new Date(),
    };

    await db
      .insert(contentStudioWizardProgressTable)
      .values({
        userId,
        currentStep: payload.currentStep ?? 1,
        topics: payload.topics ?? null,
        selectedNiche: payload.selectedNiche ?? null,
        videoType: payload.videoType ?? null,
        contentStyle: payload.contentStyle ?? null,
        scriptStrategy: payload.scriptStrategy ?? null,
      })
      .onConflictDoUpdate({
        target: contentStudioWizardProgressTable.userId,
        set: {
          ...(currentStep != null && { currentStep }),
          ...(topics !== undefined && { topics }),
          ...(selectedNiche !== undefined && { selectedNiche }),
          ...(videoType !== undefined && { videoType }),
          ...(contentStyle !== undefined && { contentStyle }),
          ...(scriptStrategy !== undefined && { scriptStrategy: scriptStrategy as Record<string, unknown> }),
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[content-studio wizard-progress PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save progress" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Clear wizard progress for the current user (e.g. when changing niche).
 * Forces the user to re-flow from step 1.
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db
      .delete(contentStudioWizardProgressTable)
      .where(eq(contentStudioWizardProgressTable.userId, userId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[content-studio wizard-progress DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear progress" },
      { status: 500 }
    );
  }
}
