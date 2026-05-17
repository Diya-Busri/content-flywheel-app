import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { designsTable } from "@/db/schema/designs-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getOwned(userId: string, id: string) {
  const [design] = await db
    .select()
    .from(designsTable)
    .where(and(eq(designsTable.id, id), eq(designsTable.userId, userId)))
    .limit(1);
  return design ?? null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const design = await getOwned(userId, params.id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ design });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const design = await getOwned(userId, params.id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (body.data) updates.data = body.data;
  if (body.previewUrl !== undefined) updates.previewUrl = body.previewUrl;

  const [updated] = await db
    .update(designsTable)
    .set(updates)
    .where(eq(designsTable.id, params.id))
    .returning();

  return NextResponse.json({ design: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const design = await getOwned(userId, params.id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(designsTable)
    .set({ deletedAt: new Date() })
    .where(eq(designsTable.id, params.id));

  return NextResponse.json({ ok: true });
}
