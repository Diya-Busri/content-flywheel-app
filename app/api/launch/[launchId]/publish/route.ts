/**
 * POST /api/launch/[launchId]/publish
 * Marks the project complete + publishes the product via the store.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ launchId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { launchId } = await params;

    const [project] = await db
      .select()
      .from(launchProjectsTable)
      .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const productId = project.stageResults?.product?.productId;

    // Publish the product if we have one
    if (productId) {
      await db
        .update(productsTable)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
    }

    // Mark launch complete
    await db
      .update(launchProjectsTable)
      .set({ status: "completed", currentStage: "complete", updatedAt: new Date() })
      .where(eq(launchProjectsTable.id, launchId));

    return NextResponse.json({ ok: true, productId });
  } catch (err) {
    console.error("[launch/publish]", err);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
