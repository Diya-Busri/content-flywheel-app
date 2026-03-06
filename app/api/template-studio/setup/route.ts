import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { templateStudioSetupTable } from "@/db/schema/template-studio-setup-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: Load saved Template Studio setup for the current user (mode + inputs).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(templateStudioSetupTable)
      .where(eq(templateStudioSetupTable.userId, userId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ mode: "1", inputs: {} });
    }

    return NextResponse.json({
      mode: row.mode,
      inputs: (row.inputs as Record<string, unknown>) ?? {},
      updatedAt: row.updatedAt?.toISOString(),
    });
  } catch (e) {
    console.error("[template-studio/setup] GET error:", e);
    return NextResponse.json(
      { error: "Failed to load setup" },
      { status: 500 }
    );
  }
}

/**
 * POST: Save Template Studio setup (mode + inputs). Upserts by user_id.
 * Body: { mode: "1" | "2" | "3", inputs: Record<string, unknown> }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = String(body.mode ?? "1").trim();
    const validMode = ["1", "2", "3"].includes(mode) ? mode : "1";
    const inputs = body.inputs && typeof body.inputs === "object" ? body.inputs as Record<string, unknown> : {};

    await db
      .insert(templateStudioSetupTable)
      .values({
        userId,
        mode: validMode,
        inputs,
      })
      .onConflictDoUpdate({
        target: templateStudioSetupTable.userId,
        set: {
          mode: validMode,
          inputs,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[template-studio/setup] POST error:", e);
    return NextResponse.json(
      { error: "Failed to save setup" },
      { status: 500 }
    );
  }
}
