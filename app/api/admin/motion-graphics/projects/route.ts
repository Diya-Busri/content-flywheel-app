/**
 * GET  /api/admin/motion-graphics/projects  — list all projects for the admin user
 * POST /api/admin/motion-graphics/projects  — create a blank project (for manual workflow)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { listProjects, createProject } from "@/lib/motion-graphics/projects-repo";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await listProjects(userId);
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const project = await createProject(userId, {
    name: body.name || "Untitled Project",
    contentMode: body.contentMode || "reddit-reaction",
    sourceText: body.sourceText || "",
    aspectRatio: body.aspectRatio || "9:16",
    cfMention: body.cfMention || "subtle",
  });

  return NextResponse.json({ project }, { status: 201 });
}
