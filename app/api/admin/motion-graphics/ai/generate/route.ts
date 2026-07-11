/**
 * POST /api/admin/motion-graphics/ai/generate
 *
 * Body: ScriptToVideoRequest { script, category, aspectRatio, tone? }
 *
 * Splits the pasted script into scenes via OpenAI, picks animations/
 * transitions from the real Animation Library, drafts captions, and saves
 * the result as a new draft Template — ready to open straight in the
 * Template Builder / render immediately.
 *
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { generateTemplateFromScript } from "@/lib/motion-graphics/ai-script-to-scenes";
import { createTemplate } from "@/lib/motion-graphics/templates-repo";
import type { ScriptToVideoRequest } from "@/lib/motion-graphics/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ScriptToVideoRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.script?.trim()) {
    return NextResponse.json({ error: "script is required" }, { status: 400 });
  }
  if (!body?.category || !body?.aspectRatio) {
    return NextResponse.json({ error: "category and aspectRatio are required" }, { status: 400 });
  }

  let draft;
  try {
    draft = await generateTemplateFromScript(body);
  } catch (err) {
    console.error("[ai/generate/route]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      { status: 502 }
    );
  }

  const template = await createTemplate(userId, draft);
  return NextResponse.json({ template }, { status: 201 });
}
