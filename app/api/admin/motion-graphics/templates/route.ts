/**
 * GET  /api/admin/motion-graphics/templates       — list the admin's templates
 * POST /api/admin/motion-graphics/templates       — create a new template
 *
 * Admin-only (see lib/motion-graphics/guard.ts). Page-level access is also
 * gated by app/dashboard/admin/layout.tsx, which every
 * /dashboard/admin/motion-graphics-studio/* page inherits.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { listTemplates, createTemplate } from "@/lib/motion-graphics/templates-repo";
import type { TemplateDraft } from "@/lib/motion-graphics/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await listTemplates(userId);
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let draft: TemplateDraft;
  try {
    draft = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!draft?.name || !draft?.category || !draft?.aspectRatio) {
    return NextResponse.json({ error: "name, category, and aspectRatio are required" }, { status: 400 });
  }

  const template = await createTemplate(userId, {
    name: draft.name,
    category: draft.category,
    aspectRatio: draft.aspectRatio,
    fps: draft.fps || 30,
    scenes: draft.scenes || [],
    status: draft.status || "draft",
    sourceScript: draft.sourceScript,
  });

  return NextResponse.json({ template }, { status: 201 });
}
