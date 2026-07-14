import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateSection, deleteCustomSection } from "@/lib/creator-hub";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: { visible?: boolean; config?: Record<string, unknown> } = {};
  if (typeof body.visible === "boolean") patch.visible = body.visible;
  if (body.config && typeof body.config === "object") patch.config = body.config;

  await updateSection(userId, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await deleteCustomSection(userId, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
