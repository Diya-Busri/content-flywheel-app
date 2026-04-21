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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });

    const body = (await request.json().catch(() => ({}))) as {
      slideType?: string;
      slideTitle?: string;
      slidePoints?: string[];
      highlightWord?: string;
      accentColour?: string;
    };

    const {
      slideType = "text_hook",
      slideTitle = "",
      slidePoints = [],
    } = body;

    const diagramUrl = await generateDiagramForScene({
      userId,
      slideType,
      slideTitle,
      slidePoints,
      apiKey,
    });

    if (!diagramUrl) return NextResponse.json({ error: "Diagram generation failed" }, { status: 422 });
    return NextResponse.json({ diagramUrl });
  } catch (err) {
    console.error("[/api/video-guide/generate-diagram]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
