import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkSpendLimit } from "@/lib/spend-guard";
import { cleanProductTitle } from "@/lib/product-title";
import { extractProductDetails } from "@/lib/tiktok-shop/extract-product";
import { generateProductBreakdown } from "@/lib/tiktok-shop/product-breakdown";
import { uploadProductImageToPublicUrl } from "@/lib/tiktok-shop/upload-product-image-public";

/**
 * POST: Generate AI product breakdown (category, audience, pain points, etc.)
 * Body: productLink OR productName OR productImageBase64, productDescription?
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sg = await checkSpendLimit("openai", userId);
    if (sg) return sg;

    const body = await request.json().catch(() => ({}));
    const {
      productLink,
      productName,
      productImageBase64,
      productDescription,
    } = body as {
      productLink?: string;
      productName?: string;
      productImageBase64?: string;
      productDescription?: string;
    };

    const hasLink = Boolean(productLink?.trim());
    const hasName = Boolean(productName?.trim());
    const hasImage = Boolean(productImageBase64?.trim());
    const hasDesc = Boolean(productDescription?.trim());

    if (!hasLink && !hasName && !hasImage) {
      return NextResponse.json(
        { error: "Provide at least one: productLink, productName, or productImageBase64." },
        { status: 400 }
      );
    }

    /** Public URL for downstream video compile (optional). Breakdown still uses base64 when upload fails. */
    let resolvedImageUrl: string | undefined;
    if (productImageBase64 && typeof productImageBase64 === "string") {
      try {
        const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const contentType = productImageBase64.startsWith("data:image/png")
          ? "image/png"
          : productImageBase64.startsWith("data:image/webp")
            ? "image/webp"
            : "image/jpeg";
        resolvedImageUrl = await uploadProductImageToPublicUrl(buffer, contentType, userId);
      } catch (err) {
        console.error("[product-breakdown] Public image upload failed; continuing with base64 only:", err);
      }
    }

    let name = productName?.trim();
    let description = productDescription?.trim();
    if (hasLink && (!description || !name)) {
      const product = await extractProductDetails(
        productLink!.trim(),
        resolvedImageUrl,
        description ?? undefined
      );
      const rawName = name ?? product.name;
      name = cleanProductTitle(rawName) || rawName;
      description = description ?? product.description;
    } else if (name) {
      name = cleanProductTitle(name) || name;
    }

    const breakdown = await generateProductBreakdown({
      productLink: hasLink ? productLink!.trim() : undefined,
      productName: name,
      productDescription: description,
      productImageBase64: hasImage ? productImageBase64 : undefined,
    });

    return NextResponse.json({
      ...breakdown,
      ...(resolvedImageUrl ? { productImageUrl: resolvedImageUrl } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Product breakdown failed";
    console.error("[product-breakdown] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
