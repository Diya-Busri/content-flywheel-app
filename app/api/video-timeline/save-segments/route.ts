/**
 * PATCH /api/video-timeline/save-segments
 * Persist pre-rendered segment URLs into a saved script's scenesJson.
 * Called after on-demand pre-rendering so subsequent exports are instant.
 *
 * Body:
 *   scriptId            string                     — saved_scripts.id
 *   segmentUrlsBySceneId Record<string, string>    — { "scene_1": "https://...", ... }
 *
 * Maps scene IDs like "scene_1", "scene_2" → scene index 0, 1, ...
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { savedScriptsTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      scriptId?: string;
      segmentUrlsBySceneId?: Record<string, string>;
    };

    const { scriptId, segmentUrlsBySceneId } = body;

    if (!scriptId?.trim()) {
      return NextResponse.json({ error: "scriptId required" }, { status: 400 });
    }
    if (!segmentUrlsBySceneId || typeof segmentUrlsBySceneId !== "object" || Object.keys(segmentUrlsBySceneId).length === 0) {
      return NextResponse.json({ error: "segmentUrlsBySceneId required" }, { status: 400 });
    }

    // Load the existing script
    const [script] = await db
      .select()
      .from(savedScriptsTable)
      .where(and(eq(savedScriptsTable.id, scriptId.trim()), eq(savedScriptsTable.userId, userId)))
      .limit(1);

    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const scenesJson = Array.isArray(script.scenesJson) ? script.scenesJson : [];

    // Map scene IDs (e.g. "scene_1") → zero-based index
    // scene_N → index N-1; any other format → try to find by index
    const updatedScenes = scenesJson.map((scene, idx) => {
      const sceneId = `scene_${idx + 1}`;
      const segUrl = segmentUrlsBySceneId[sceneId];
      if (segUrl && typeof segUrl === "string" && segUrl.startsWith("http")) {
        return { ...scene, segment_url: segUrl };
      }
      return scene;
    });

    await db
      .update(savedScriptsTable)
      .set({ scenesJson: updatedScenes })
      .where(and(eq(savedScriptsTable.id, scriptId.trim()), eq(savedScriptsTable.userId, userId)));

    return NextResponse.json({ ok: true, updated: Object.keys(segmentUrlsBySceneId).length });
  } catch (err) {
    console.error("[video-timeline/save-segments]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save segments" },
      { status: 500 }
    );
  }
}
