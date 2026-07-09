import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { contentBundlesTable, ContentAssets } from "@/db/schema/bundles-schema";
import { designsTable } from "@/db/schema/designs-schema";
import { eq, and, isNull, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [bundle] = await db
    .select()
    .from(contentBundlesTable)
    .where(and(eq(contentBundlesTable.id, params.id), eq(contentBundlesTable.userId, userId), isNull(contentBundlesTable.deletedAt)));

  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slides = await db
    .select()
    .from(designsTable)
    .where(and(eq(designsTable.bundleId, params.id), eq(designsTable.userId, userId), isNull(designsTable.deletedAt)))
    .orderBy(asc(designsTable.slideIndex));

  return NextResponse.json({ bundle, slides });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    title?: string;
    coverPreviewUrl?: string;
    slideCount?: number;
    assets?: ContentAssets;
    slideOrder?: { id: string; slideIndex: number }[];
  };

  const patch: Partial<typeof contentBundlesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.title === "string") patch.title = body.title.trim() || "Untitled Bundle";
  if (typeof body.coverPreviewUrl === "string") patch.coverPreviewUrl = body.coverPreviewUrl;
  if (typeof body.slideCount === "number") patch.slideCount = body.slideCount;
  if (body.assets && typeof body.assets === "object") patch.assets = body.assets;

  await db
    .update(contentBundlesTable)
    .set(patch)
    .where(and(eq(contentBundlesTable.id, params.id), eq(contentBundlesTable.userId, userId)));

  // Reorder slides if provided
  if (Array.isArray(body.slideOrder) && body.slideOrder.length > 0) {
    await Promise.all(
      body.slideOrder.map(({ id, slideIndex }) =>
        db.update(designsTable)
          .set({ slideIndex })
          .where(and(eq(designsTable.id, id), eq(designsTable.userId, userId)))
      )
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Soft-delete the bundle and all its slides
  await Promise.all([
    db.update(contentBundlesTable)
      .set({ deletedAt: now })
      .where(and(eq(contentBundlesTable.id, params.id), eq(contentBundlesTable.userId, userId))),
    db.update(designsTable)
      .set({ deletedAt: now })
      .where(and(eq(designsTable.bundleId, params.id), eq(designsTable.userId, userId))),
  ]);

  return NextResponse.json({ ok: true });
}
