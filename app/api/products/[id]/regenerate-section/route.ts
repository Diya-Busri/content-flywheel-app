export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  generateSingleSectionBody,
  type GenerateProductContentParams,
} from "@/lib/generate-product-content";
import { cleanProductTitle } from "@/lib/product-title";

/**
 * POST: Regenerate content for a single section using full product context (format, niche, etc.).
 * Use for empty or unsatisfactory sections. Uses the same format-aware generation as initial product creation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const sectionId = typeof body.sectionId === "string" ? body.sectionId.trim() : "";
    if (!sectionId) {
      return NextResponse.json(
        { error: "sectionId is required" },
        { status: 400 }
      );
    }

    const [product] = await db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        niche: productsTable.niche,
        format: productsTable.format,
        content: productsTable.content,
        customizationOptions: productsTable.customizationOptions,
      })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      )
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const sections = product.content?.sections ?? [];
    const sectionIndex = sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex === -1) {
      return NextResponse.json(
        { error: "Section not found in this product" },
        { status: 404 }
      );
    }

    const section = sections[sectionIndex];
    const productName = cleanProductTitle(product.title ?? "") || (product.title ?? "");
    const niche = product.niche ?? "";
    const format = (product.format ?? "ebook").toString();

    const customizationOptions =
      product.customizationOptions != null &&
      typeof product.customizationOptions === "object"
        ? (product.customizationOptions as GenerateProductContentParams["customizationOptions"])
        : undefined;

    const generateParams: GenerateProductContentParams = {
      productName,
      productDescription: "",
      productIncluded: "",
      productWhy: "",
      niche,
      format,
      hookTexts: [],
      ctaTexts: [],
      customizationOptions,
    };

    const { body: newBody } = await generateSingleSectionBody(
      generateParams,
      { id: section.id, title: section.title },
      sectionIndex,
      sections.length
    );

    const newContent = newBody?.trim() ?? "";
    const updatedSections = sections.map((s, i) =>
      i === sectionIndex
        ? {
            ...s,
            content: newContent,
            contentHtml: newContent,
          }
        : s
    );

    await db
      .update(productsTable)
      .set({
        content: { sections: updatedSections },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    return NextResponse.json({ newContent });
  } catch (err) {
    console.error("[products/[id]/regenerate-section]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to regenerate section",
      },
      { status: 500 }
    );
  }
}
