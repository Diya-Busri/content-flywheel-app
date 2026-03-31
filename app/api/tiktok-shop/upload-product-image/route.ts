/**
 * POST: Upload a product image (data URL base64) for TikTok Affiliate video compile.
 * Blob first, then Supabase timeline-media. Returns { url } for FFmpeg / saved-scripts.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { uploadProductImageToPublicUrl } from "@/lib/tiktok-shop/upload-product-image-public";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const productImageBase64 =
      typeof (body as { productImageBase64?: string }).productImageBase64 === "string"
        ? (body as { productImageBase64: string }).productImageBase64.trim()
        : "";

    if (!productImageBase64) {
      return NextResponse.json({ error: "productImageBase64 is required" }, { status: 400 });
    }

    const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const contentType = productImageBase64.startsWith("data:image/png")
      ? "image/png"
      : productImageBase64.startsWith("data:image/webp")
        ? "image/webp"
        : "image/jpeg";

    const url = await uploadProductImageToPublicUrl(buffer, contentType, userId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload-product-image]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
