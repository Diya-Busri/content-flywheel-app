/**
 * POST /api/admin/motion-graphics/projects/:id/regenerate-scene
 *
 * Regenerates a single scene within a project's storyboard.
 * Body: { sceneId: string; visualType?: StoryboardVisualType }
 *
 * Uses Claude to generate replacement narration, on-screen text, and
 * asset suggestions for one scene without touching the rest of the storyboard.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { getProject } from "@/lib/motion-graphics/projects-repo";
import type { StoryboardScene, StoryboardVisualType, AnimationId } from "@/lib/motion-graphics/types";

type Ctx = { params: Promise<{ projectId: string }> };

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

const VALID_TRANSITIONS: AnimationId[] = [
  "fadeIn", "slideLeft", "slideRight", "slideUp", "slideDown", "scaleIn", "blurReveal", "punchIn",
];

function pickTransition(v: unknown): AnimationId {
  return VALID_TRANSITIONS.includes(v as AnimationId) ? (v as AnimationId) : "fadeIn";
}

async function callAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content: "You are a short-form video script writer. Return ONLY valid JSON, no prose.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { projectId } = await params;
  const body = await request.json().catch(() => ({})) as {
    sceneId?: string;
    visualType?: StoryboardVisualType;
  };

  if (!body.sceneId) {
    return NextResponse.json({ error: "sceneId required" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const existingScene = project.shortForm?.scenes?.find((s) => s.id === body.sceneId);
  if (!existingScene) {
    return NextResponse.json({ error: "Scene not found in project" }, { status: 404 });
  }

  const visualType = body.visualType ?? existingScene.visualType;
  const sceneIndex = (project.shortForm?.scenes ?? []).findIndex((s) => s.id === body.sceneId);
  const totalScenes = project.shortForm?.scenes?.length ?? 1;

  const prompt = `You are a short-form video script writer. Regenerate ONE scene for a faceless video.

PROJECT CONTEXT:
- Source material: "${project.sourceText?.slice(0, 400) ?? ""}"
- Video title: "${project.shortForm?.title ?? ""}"
- This is scene ${sceneIndex + 1} of ${totalScenes}
- Current narration: "${existingScene.narration}"
- Current on-screen text: "${existingScene.onScreenText}"
- Visual type: ${visualType}

TASK: Rewrite this scene with fresh narration and on-screen text. Keep the same visual type.
The narration should be 1-3 sentences (natural spoken language). The on-screen text should be max 8 words.

IMPORTANT:
- Do NOT invent usernames, subreddit names, upvotes, comments, dates, or engagement numbers.
- Do NOT copy Reddit branding.
- Return ONLY valid JSON, no prose:

{
  "narration": "string",
  "onScreenText": "string (max 8 words)",
  "animationPreset": "fadeIn | slideLeft | slideRight | slideUp | slideDown | scaleIn | blurReveal | punchIn",
  "assetSuggestions": ["string"],
  "emphasisWords": ["word1", "word2"],
  "soundEffect": null
}`;

  try {
    const raw = await callAI(prompt);

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      narration?: string;
      onScreenText?: string;
      animationPreset?: string;
      assetSuggestions?: string[];
      emphasisWords?: string[];
      soundEffect?: string | null;
    };

    const needsAsset =
      visualType === "app-demo" ||
      visualType === "screen-recording" ||
      visualType === "b-roll-placeholder";

    const regeneratedScene: StoryboardScene = {
      ...existingScene,
      visualType,
      narration: parsed.narration ?? existingScene.narration,
      onScreenText: parsed.onScreenText ?? existingScene.onScreenText,
      animationPreset: pickTransition(parsed.animationPreset),
      assetSuggestions: Array.isArray(parsed.assetSuggestions) ? parsed.assetSuggestions : existingScene.assetSuggestions,
      emphasisWords: Array.isArray(parsed.emphasisWords) ? parsed.emphasisWords : existingScene.emphasisWords,
      soundEffect: parsed.soundEffect ?? existingScene.soundEffect,
      missingAsset: needsAsset && !existingScene.assetUrl,
    };

    return NextResponse.json({ scene: regeneratedScene });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI regeneration failed";
    console.error("[regenerate-scene]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
