/**
 * POST /api/video-guide/generate-diagram
 *
 * Standalone endpoint for generating a Napkin AI diagram for a single
 * Dark Infographic slide. Can also be called from the frontend to
 * regenerate a specific scene's diagram.
 *
 * Body: { slideTitle, slidePoints, slideType, sceneContext? }
 * Returns: { diagramUrl: string } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { generateDiagramForScene } from "@/lib/video-guide/generate-diagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      slideType?: string;
      slideTitle?: string;
      slidePoints?: string[];
      sceneContext?: string;
    };

    const {
      slideType = "text_hook",
      slideTitle = "",
      slidePoints = [],
      sceneContext = "",
    } = body;

    const diagramUrl = await generateDiagramForScene({
      userId,
      slideType,
      slideTitle,
      slidePoints,
      sceneContext,
    });

    if (!diagramUrl) {
      return NextResponse.json({ error: "Diagram generation failed" }, { status: 422 });
    }
    return NextResponse.json({ diagramUrl });
  } catch (err) {
    console.error("[/api/video-guide/generate-diagram]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
