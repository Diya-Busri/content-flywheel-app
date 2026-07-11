/**
 * GET    /api/admin/motion-graphics/templates/:templateId — fetch one template
 * PATCH  /api/admin/motion-graphics/templates/:templateId — update name/category/
 *        aspectRatio/fps/scenes/status (the Template Builder + Scene Editor
 *        both save through this route)
 * DELETE /api/admin/motion-graphics/templates/:templateId
 *
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/motion-graphics/templates-repo";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { templateId: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const template = await getTemplate(params.templateId);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PATCH(request: NextRequest, { params }: { params: { templateId: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let patch: Record<string, unknown>;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowedKeys = ["name", "category", "aspectRatio", "fps", "scenes", "status"] as const;
  const sanitized: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in patch) sanitized[key] = patch[key];
  }

  const template = await updateTemplate(params.templateId, sanitized);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_request: NextRequest, { params }: { params: { templateId: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  await deleteTemplate(params.templateId);
  return NextResponse.json({ ok: true });
}
