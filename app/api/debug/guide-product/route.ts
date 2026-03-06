/**
 * GET /api/debug/guide-product?guideId=uuid
 * Returns the script (guide) row and linked product so you can see what product name is stored.
 * Run in browser or curl while logged in. Do not use in production.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);

    if (rl) return rl;

    const guideId = request.nextUrl.searchParams.get("guideId")?.trim();
    if (!guideId) {
      return NextResponse.json(
        { error: "guideId required. Example: /api/debug/guide-product?guideId=b778c2c3-a8b7-41bf-9f9c-ae687ed86c53" },
        { status: 400 }
      );
    }

    const [scriptRow] = await db
      .select()
      .from(scriptsTable)
      .where(
        and(
          eq(scriptsTable.id, guideId),
          eq(scriptsTable.userId, userId),
          isNull(scriptsTable.deletedAt)
        )
      )
      .limit(1);

    if (!scriptRow) {
      return NextResponse.json({ error: "Script not found", guideId }, { status: 404 });
    }

    let productRow: { id: string; title: string; marketingAssets: unknown } | null = null;
    if (scriptRow.productId) {
      const [p] = await db
        .select({ id: productsTable.id, title: productsTable.title, marketingAssets: productsTable.marketingAssets })
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, scriptRow.productId),
            eq(productsTable.userId, userId),
            isNull(productsTable.deletedAt)
          )
        )
        .limit(1);
      productRow = p ?? null;
    }

    let contentProductName: string | null = null;
    try {
      const content = typeof scriptRow.content === "string" ? JSON.parse(scriptRow.content) : scriptRow.content;
      contentProductName = (content?.productName ?? null) ?? null;
    } catch {
      // ignore
    }

    const marketingTitle =
      productRow && productRow.marketingAssets && typeof productRow.marketingAssets === "object"
        ? (productRow.marketingAssets as { productTitle?: string }).productTitle ?? null
        : null;

    return NextResponse.json({
      guideId: scriptRow.id,
      script: {
        id: scriptRow.id,
        title: scriptRow.title,
        product_id: scriptRow.productId ?? null,
        contentProductName,
      },
      product: productRow
        ? {
            id: productRow.id,
            title: productRow.title,
            marketingProductTitle: marketingTitle,
          }
        : null,
      summary: {
        productNameFromContent: contentProductName,
        productNameFromProductTitle: productRow?.title ?? null,
        productNameFromMarketing: marketingTitle ?? productRow?.title ?? null,
      },
    });
  } catch (e) {
    console.error("[debug/guide-product]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
