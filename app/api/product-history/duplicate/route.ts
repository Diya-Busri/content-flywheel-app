export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productHistoryTable } from "@/db/schema/product-history-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";

/**
 * POST: Create a new product from a history record (Duplicate). Body: { historyId }.
 * Returns { productId } so the client can redirect to the editor.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const historyId = (body.historyId as string)?.trim();
    if (!historyId) {
      return NextResponse.json(
        { error: "historyId is required" },
        { status: 400 }
      );
    }

    const [row] = await db
      .select()
      .from(productHistoryTable)
      .where(
        and(
          eq(productHistoryTable.id, historyId),
          eq(productHistoryTable.userId, userId)
      ));

    if (!row) {
      return NextResponse.json(
        { error: "History record not found" },
        { status: 404 }
      );
    }

    const contentJson = row.contentJson as Record<string, unknown> | null;
    const sections = Array.isArray((contentJson?.sections as unknown[]) ?? null)
      ? (contentJson!.sections as Array<{ id: string; title: string; content: string; order: number; imageUrl?: string }>)
      : [];
    const designSettings =
      contentJson?.designSettings != null &&
      typeof contentJson.designSettings === "object"
        ? (contentJson.designSettings as Record<string, unknown>)
        : {
            template: "modern",
            colors: { primary: "#FF6B35", secondary: "#004E89", accent: "#F7B32B", graphics: "#FF6B35" },
            typography: { heading: "Inter", body: "Open Sans", size: 16 },
          };

    const [inserted] = await db
      .insert(productsTable)
      .values({
        userId,
        title: row.productTitle,
        niche: "",
        format: row.formatType,
        content: { sections },
        designSettings,
        placedElements: [],
        customizationOptions: null,
        status: "draft",
      })
      .returning({ id: productsTable.id });

    if (!inserted?.id) {
      return NextResponse.json(
        { error: "Failed to create product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ productId: inserted.id });
  } catch (e) {
    console.error("[product-history] duplicate error:", e);
    return NextResponse.json(
      { error: "Failed to duplicate product" },
      { status: 500 }
    );
  }
}
