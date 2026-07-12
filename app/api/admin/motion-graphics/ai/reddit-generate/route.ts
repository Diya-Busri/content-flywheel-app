/**
 * POST /api/admin/motion-graphics/ai/reddit-generate
 *
 * Takes a Reddit post / creator complaint / source material and generates:
 *   - Content analysis (core problem, hook, audience, insight)
 *   - 5-scene short-form storyboard (30–60 sec)
 *   - Long-form chapter plan
 *
 * Saves the result as a new ContentProject row and returns the project.
 * The user is then redirected to the storyboard review page.
 *
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { generateStoryboardFromReddit } from "@/lib/motion-graphics/ai-reddit-to-storyboard";
import { createProject } from "@/lib/motion-graphics/projects-repo";
import type { RedditGenerateRequest } from "@/lib/motion-graphics/types";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: RedditGenerateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.sourceText?.trim()) {
    return NextResponse.json({ error: "sourceText is required" }, { status: 400 });
  }

  let result;
  try {
    result = await generateStoryboardFromReddit(body);
  } catch (err) {
    console.error("[reddit-generate/route]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 502 }
    );
  }

  // Determine initial status — projects with app-demo scenes need assets
  const needsAssets = result.shortForm.scenes.some((s) => s.missingAsset);

  const project = await createProject(userId, {
    name: result.name,
    contentMode: body.contentMode,
    status: needsAssets ? "needs_assets" : "ready_to_render",
    sourceText: body.sourceText,
    sourceUrl: body.sourceUrl,
    targetAudience: body.targetAudience,
    mainOpinion: body.mainOpinion,
    desiredCta: body.desiredCta,
    cfMention: body.cfMention ?? "subtle",
    videoDuration: body.videoDuration,
    tone: body.tone,
    aspectRatio: body.aspectRatio ?? "9:16",
    analysis: result.analysis,
    shortForm: result.shortForm,
    longForm: result.longForm,
  });

  return NextResponse.json({ project }, { status: 201 });
}
