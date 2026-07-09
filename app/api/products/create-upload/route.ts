import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { markOnboardingStep } from "@/lib/onboarding-auto-complete";

export const dynamic = "force-dynamic";

/** Creates a product record for a manually-uploaded (non-AI) product. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { title, description, fileUrl, fileName, fileType, coverImageUrl, priceLabel, format } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!fileUrl?.trim()) return NextResponse.json({ error: "Product file is required" }, { status: 400 });

    // Detect format from file type
    const resolvedFormat = format ?? resolveFormatFromType(fileType ?? "");

    const [product] = await db
      .insert(productsTable)
      .values({
        userId,
        title: title.trim(),
        niche: description?.trim() || "Digital Product",
        format: resolvedFormat,
        content: { sections: [] },
        status: "complete",
        generationStatus: "complete",
        designSource: null,
        marketingAssets: {
          uploadedFileUrl: fileUrl,
          uploadedFileName: fileName ?? null,
          productDescription: description?.trim() || null,
          coverThumbnailUrl: coverImageUrl ?? null,
          priceLabel: priceLabel?.trim() || null,
          // Mark as published/listed so it shows on the creator store
          ...(priceLabel?.trim() ? { checkoutUrl: null } : {}),
        },
      })
      .returning({ id: productsTable.id, title: productsTable.title });

    markOnboardingStep(userId, "firstProduct").catch(() => {});
    return NextResponse.json({ id: product.id, title: product.title }, { status: 201 });
  } catch (err) {
    console.error("[create-upload] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product" },
      { status: 500 }
    );
  }
}

function resolveFormatFromType(mimeType: string): string {
  if (mimeType.includes("pdf")) return "ebook";
  if (mimeType.includes("zip")) return "guide";
  if (mimeType.includes("word")) return "guide";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "course";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "planner";
  if (mimeType.includes("epub")) return "ebook";
  if (mimeType.includes("image")) return "guide";
  return "ebook";
}
