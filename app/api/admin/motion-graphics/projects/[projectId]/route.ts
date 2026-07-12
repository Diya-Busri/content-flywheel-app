/**
 * GET   /api/admin/motion-graphics/projects/:id  — fetch a single project
 * PATCH /api/admin/motion-graphics/projects/:id  — update storyboard scenes / status
 * DELETE /api/admin/motion-graphics/projects/:id — delete project
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { getProject, updateProject, deleteProject } from "@/lib/motion-graphics/projects-repo";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));

  const project = await updateProject(projectId, body);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { projectId } = await params;
  await deleteProject(projectId);
  return NextResponse.json({ ok: true });
}
