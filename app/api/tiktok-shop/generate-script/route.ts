import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { cleanProductTitle } from "@/lib/product-title";
import type { VideoStyle, HookStyle, ScriptTone } from "@/lib/tiktok-shop/types";
import { extractProductDetails } from "@/lib/tiktok-shop/extract-product";
import { generateVideoScript } from "@/lib/tiktok-shop/generate-script";
import { uploadProductImageToPublicUrl } from "@/lib/tiktok-shop/upload-product-image-public";

const VIDEO_STYLES: VideoStyle[] = ["unboxing", "demo", "before-after"];

/**
 * POST: Generate script (full or regenerate one section).
 * Body: productLink OR (productName + productDescription), productImageBase64?, videoStyle?, targetDurationSec?, hookStyle?, tone?, regenerateSection?, existingScenes?
 * Returns: { fullScript, scenes, productName }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);

    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const {
      productLink,
      productName,
      productImageBase64,
      productDescription,
      videoStyle,
      targetDurationSec,
      hookStyle,
      tone,
      regenerateSection,
      existingScenes,
    } = body as {
      productLink?: string;
      productName?: string;
      productImageBase64?: string;
      productDescription?: string;
      videoStyle?: string;
      targetDurationSec?: number;
      hookStyle?: string;
      tone?: string;
      regenerateSection?: "hook" | "pain" | "solution" | "proof" | "cta";
      existingScenes?: { hook: string; pain: string; solution: string; proof_points?: string[]; cta: string };
    };

    const hasLink = Boolean(productLink?.trim());
    const hasNameAndDesc = Boolean(productName?.trim() && productDescription?.trim());
    if (!hasLink && !hasNameAndDesc) {
      return NextResponse.json(
        { error: "Provide productLink OR (productName + productDescription)." },
        { status: 400 }
      );
    }

    let name: string;
    let description: string;
    let resolvedImageUrl: string | undefined;

    if (hasLink) {
      const descTrimmed = typeof productDescription === "string" ? productDescription.trim() : "";
      if (!descTrimmed) {
        return NextResponse.json(
          { error: "Product description is required when using productLink." },
          { status: 400 }
        );
      }
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
        } catch {
          // continue without image
        }
      }
      const product = await extractProductDetails(productLink!.trim(), resolvedImageUrl, descTrimmed);
      name = cleanProductTitle(product.name) || product.name;
      description = product.description;
    } else {
      const raw = productName!.trim();
      name = cleanProductTitle(raw) || raw;
      description = productDescription!.trim();
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
        } catch {
          // continue without image
        }
      }
    }

    const style = VIDEO_STYLES.includes(videoStyle as VideoStyle) ? (videoStyle as VideoStyle) : "demo";

    const scriptResult = await generateVideoScript({
      productName: name,
      productDescription: description,
      videoStyle: style,
      platform: "tiktok",
      targetDurationSec: targetDurationSec != null && targetDurationSec >= 15 && targetDurationSec <= 120 ? targetDurationSec : undefined,
      hookStyle: hookStyle as HookStyle | undefined,
      tone: tone as ScriptTone | undefined,
      regenerateSection,
      existingScenes,
    });

    return NextResponse.json({
      fullScript: scriptResult.fullScript,
      scenes: scriptResult.scenes,
      productName: name,
      ...(resolvedImageUrl ? { productImageUrl: resolvedImageUrl } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Script generation failed";
    console.error("[generate-script] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
