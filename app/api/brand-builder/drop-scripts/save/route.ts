import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { dropScriptsTable } from "@/db/schema/drop-scripts-schema";

export const dynamic = "force-dynamic";

/**
 * POST: Save a drop script to Supabase.
 * Body: brandName, dropType, vibe, milestone?, scriptType, hook, middle, cta, text_overlays[], suggested_audio?
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    if (!brandName) {
      return NextResponse.json({ error: "brandName is required" }, { status: 400 });
    }
    const dropType = typeof body.dropType === "string" ? body.dropType.trim() : "first drop";
    const vibe = typeof body.vibe === "string" ? body.vibe.trim() : null;
    const milestone = typeof body.milestone === "string" ? body.milestone.trim() || null : null;
    const scriptType = typeof body.scriptType === "string" ? body.scriptType.trim() : "";
    if (!scriptType) {
      return NextResponse.json({ error: "scriptType is required" }, { status: 400 });
    }
    const hook = typeof body.hook === "string" ? body.hook.trim() : "";
    const middle = typeof body.middle === "string" ? body.middle.trim() : "";
    const cta = typeof body.cta === "string" ? body.cta.trim() : "";
    const textOverlays = Array.isArray(body.text_overlays)
      ? (body.text_overlays as unknown[]).map((x) => (typeof x === "string" ? x : String(x)))
      : [];
    const suggestedAudio = typeof body.suggested_audio === "string" ? body.suggested_audio.trim() || null : null;

    const [row] = await db
      .insert(dropScriptsTable)
      .values({
        userId,
        brandName,
        dropType,
        vibe,
        milestone,
        scriptType,
        hook,
        middle,
        cta,
        textOverlays,
        suggestedAudio,
      })
      .returning();

    return NextResponse.json({
      id: row.id,
      scriptType: row.scriptType,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[brand-builder/drop-scripts/save]", e);
    return NextResponse.json({ error: "Failed to save script." }, { status: 500 });
  }
}
