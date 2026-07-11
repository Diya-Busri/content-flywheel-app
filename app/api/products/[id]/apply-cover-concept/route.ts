export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * POST /api/products/[id]/apply-cover-concept
 * Applies a selected cover concept image as the product editor's cover page background.
 * Merges into existing designSettings.pages without clobbering other page data.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { conceptUrl } = body as { conceptUrl?: string };
    if (!conceptUrl) return NextResponse.json({ error: "conceptUrl required" }, { status: 400 });

    // Fetch current designSettings so we can merge (not overwrite)
    const [product] = await db
      .select({ designSettings: productsTable.designSettings })
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const designSettings = ((product.designSettings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const existingPages = Array.isArray(designSettings.pages)
      ? (designSettings.pages as Record<string, unknown>[])
      : [];

    // Build updated cover page — keep existing placed elements / overlay tweaks but set the image
    const coverPageBg: Record<string, unknown> = {
      ...(existingPages[0] ?? {}),
      backgroundImage: conceptUrl,
      backgroundSettings: {
        opacity: 1,
        blur: 0,
        brightness: 75,
        contrast: 100,
        saturation: 100,
        fit: "cover",
        position: "center",
      },
      overlaySettings: { color: "#000000", opacity: 0.3 },
    };

    const nextPages =
      existingPages.length > 0
        ? [coverPageBg, ...existingPages.slice(1)]
        : [coverPageBg];

    const nextDesignSettings = { ...designSettings, pages: nextPages };

    await db
      .update(productsTable)
      .set({ designSettings: nextDesignSettings, updatedAt: new Date() })
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("apply-cover-concept failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
