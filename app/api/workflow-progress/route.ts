import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { workflowProgressTable } from "@/db/schema/workflow-progress-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: Load saved workflow progress for the current user.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [row] = await db
      .select()
      .from(workflowProgressTable)
      .where(eq(workflowProgressTable.userId, userId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        workflowData: row.workflowData as Record<string, unknown>,
        currentStep: row.currentStep,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error("[workflow-progress GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load progress" },
      { status: 500 }
    );
  }
}

/**
 * PUT: Save workflow progress for the current user.
 * Body: { workflowData: Record<string, unknown>, currentStep: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const workflowData = body.workflowData != null && typeof body.workflowData === "object"
      ? body.workflowData
      : {};
    const currentStep = typeof body.currentStep === "number" && Number.isInteger(body.currentStep) && body.currentStep >= 1 && body.currentStep <= 8
      ? body.currentStep
      : 1;

    await db
      .insert(workflowProgressTable)
      .values({
        userId,
        workflowData: workflowData as Record<string, unknown>,
        currentStep,
      })
      .onConflictDoUpdate({
        target: workflowProgressTable.userId,
        set: {
          workflowData: workflowData as Record<string, unknown>,
          currentStep,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[workflow-progress PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save progress" },
      { status: 500 }
    );
  }
}
