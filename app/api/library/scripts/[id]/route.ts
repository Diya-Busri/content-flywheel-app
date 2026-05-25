export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { eq, and, isNull } from "drizzle-orm";

/** PATCH: Update video-guide timeline state or script. Body: { timelineMutedClipIds?, timelineSceneSlots?, timelineVoiceoverUrl?, timelineVoiceoverDuration?, timelineSceneVoiceoverUrls?, script?, productName?, scenes?, scenePrompts?, storytellingFramework?, frameworkRationale?, engagementTriggers? }. At least one key required. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Script ID required" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const timelineMutedClipIds = Array.isArray(body.timelineMutedClipIds)
      ? (body.timelineMutedClipIds as string[]).filter((x) => typeof x === "string")
      : undefined;
    const timelineSceneSlots = Array.isArray(body.timelineSceneSlots) ? body.timelineSceneSlots : undefined;
    const timelineVoiceoverUrl =
      typeof body.timelineVoiceoverUrl === "string" && body.timelineVoiceoverUrl.trim()
        ? body.timelineVoiceoverUrl.trim()
        : undefined;
    const timelineVoiceoverDuration =
      typeof body.timelineVoiceoverDuration === "number"
        ? body.timelineVoiceoverDuration
        : undefined;
    const timelineSceneVoiceoverUrls = Array.isArray(body.timelineSceneVoiceoverUrls)
      ? (body.timelineSceneVoiceoverUrls as string[]).filter((x) => typeof x === "string")
      : undefined;
    const productName =
      typeof body.productName === "string" ? (body.productName as string).trim() || undefined : undefined;
    const scriptBody = body.script;
    const script =
      scriptBody && typeof scriptBody === "object" && !Array.isArray(scriptBody)
        ? {
            hook: typeof scriptBody.hook === "string" ? scriptBody.hook : undefined,
            body: typeof scriptBody.body === "string" ? scriptBody.body : undefined,
            cta: typeof scriptBody.cta === "string" ? scriptBody.cta : undefined,
          }
        : undefined;
    const hasScript = script && (script.hook !== undefined || script.body !== undefined || script.cta !== undefined);
    const scenes = Array.isArray(body.scenes) ? body.scenes : undefined;
    const scenePrompts = Array.isArray(body.scenePrompts) ? body.scenePrompts : undefined;
    const storytellingFramework = typeof body.storytellingFramework === "string" ? body.storytellingFramework : undefined;
    const frameworkRationale = typeof body.frameworkRationale === "string" ? body.frameworkRationale : undefined;
    const engagementTriggers = Array.isArray(body.engagementTriggers) ? body.engagementTriggers : undefined;
    const hasScenesUpdate = scenes !== undefined || scenePrompts !== undefined || storytellingFramework !== undefined || frameworkRationale !== undefined || engagementTriggers !== undefined;

    if (
      timelineMutedClipIds === undefined &&
      timelineSceneSlots === undefined &&
      timelineVoiceoverUrl === undefined &&
      timelineVoiceoverDuration === undefined &&
      timelineSceneVoiceoverUrls === undefined &&
      !hasScript &&
      !hasScenesUpdate
    ) {
      return NextResponse.json(
        { error: "At least one of timelineMutedClipIds, timelineSceneSlots, timelineVoiceoverUrl, timelineVoiceoverDuration, timelineSceneVoiceoverUrls, script, scenes/scenePrompts required" },
        { status: 400 }
      );
    }

    const [row] = await db
      .select()
      .from(scriptsTable)
      .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    const isVideoGuide = row.platform === "video-guide" || row.platform === "content-studio";
    if (!isVideoGuide) {
      return NextResponse.json({ error: "Timeline state only applies to video guides" }, { status: 400 });
    }

    let content: Record<string, unknown> = {};
    try {
      content = typeof row.content === "string" ? JSON.parse(row.content) : { ...(row.content as Record<string, unknown>) };
    } catch {
      return NextResponse.json({ error: "Invalid script content" }, { status: 400 });
    }
    if (timelineMutedClipIds !== undefined) content.timelineMutedClipIds = timelineMutedClipIds;
    if (timelineSceneSlots !== undefined) content.timelineSceneSlots = timelineSceneSlots;
    if (timelineVoiceoverUrl !== undefined) content.timelineVoiceoverUrl = timelineVoiceoverUrl;
    if (timelineVoiceoverDuration !== undefined) content.timelineVoiceoverDuration = timelineVoiceoverDuration;
    if (timelineSceneVoiceoverUrls !== undefined) content.timelineSceneVoiceoverUrls = timelineSceneVoiceoverUrls;
    if (productName !== undefined) content.productName = productName;
    if (hasScript) {
      const existing = (content.script && typeof content.script === "object" ? content.script : {}) as Record<string, unknown>;
      content.script = { ...existing, ...script };
    }
    if (scenes !== undefined) content.scenes = scenes;
    if (scenePrompts !== undefined) content.scenePrompts = scenePrompts;
    if (storytellingFramework !== undefined) content.storytellingFramework = storytellingFramework;
    if (frameworkRationale !== undefined) content.frameworkRationale = frameworkRationale;
    if (engagementTriggers !== undefined) content.engagementTriggers = engagementTriggers;

    const [updated] = await db
      .update(scriptsTable)
      .set({ content: JSON.stringify(content), updatedAt: new Date() })
      .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)))
      .returning();
    if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Library script PATCH failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update script" },
      { status: 500 }
    );
  }
}

/** GET: Fetch a single script by id (e.g. to view a saved video guide). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Script ID required" }, { status: 400 });

    const [row] = await db
      .select()
      .from(scriptsTable)
      .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Script not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error("Library script get failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch script" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Script ID required" }, { status: 400 });
    }
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    if (permanent) {
      await db
        .delete(scriptsTable)
        .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)));
    } else {
      const [updated] = await db
        .update(scriptsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)))
        .returning();
      if (!updated) {
        return NextResponse.json({ error: "Script not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Library script delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete script" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Script ID required" }, { status: 400 });
    }
    const [updated] = await db
      .update(scriptsTable)
      .set({ deletedAt: null })
      .where(and(eq(scriptsTable.id, id), eq(scriptsTable.userId, userId)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Library script restore failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to restore script" },
      { status: 500 }
    );
  }
}
