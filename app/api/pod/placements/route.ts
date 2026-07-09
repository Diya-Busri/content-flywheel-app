export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

type Placement = { position: string; designFileUrl: string; designFileName?: string };

/** PATCH — add or update a placement design on an existing product */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { productId, position, designFileUrl, designFileName } = await req.json() as {
      productId: string;
      position: string;
      designFileUrl: string;
      designFileName?: string;
    };

    if (!productId || !position || !designFileUrl) {
      return NextResponse.json({ error: "productId, position and designFileUrl are required" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const currentPlacements = (product.placements as Placement[] | null) ?? [];

    // If this position already exists, replace it; otherwise append
    const updatedPlacements: Placement[] = [
      ...currentPlacements.filter((p) => p.position !== position),
      { position, designFileUrl, designFileName },
    ];

    // If updating front, also update the main designFileUrl column
    const extraUpdate =
      position === "front"
        ? { designFileUrl, designFileName: designFileName ?? product.designFileName }
        : {};

    await db
      .update(podProductsTable)
      .set({ placements: updatedPlacements, ...extraUpdate })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ placements: updatedPlacements });
  } catch (err) {
    console.error("[pod/placements] PATCH:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update placement" }, { status: 500 });
  }
}

/** DELETE — remove a placement design from a product */
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { productId, position } = await req.json() as { productId: string; position: string };

    if (!productId || !position) {
      return NextResponse.json({ error: "productId and position are required" }, { status: 400 });
    }

    const [product] = await db
      .select({ placements: podProductsTable.placements })
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const updatedPlacements = ((product.placements as Placement[]) ?? []).filter(
      (p) => p.position !== position
    );

    await db
      .update(podProductsTable)
      .set({ placements: updatedPlacements })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ placements: updatedPlacements });
  } catch (err) {
    console.error("[pod/placements] DELETE:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to remove placement" }, { status: 500 });
  }
}
