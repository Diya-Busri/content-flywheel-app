import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { VideoStyle } from "@/lib/tiktok-shop/types";
import { extractProductDetails } from "@/lib/tiktok-shop/extract-product";
import { generateVideoScript } from "@/lib/tiktok-shop/generate-script";
import { uploadProductImageToBlob } from "@/lib/tiktok-shop/upload-product-image-blob";
import { uploadVideoFromUrlToBlob } from "@/lib/tiktok-shop/upload-video-blob";
import { storeTiktokShopVideo } from "@/lib/tiktok-shop/store-video";
import { getShotstackApiKey, renderShotstack } from "@/lib/shotstack-edit";

const VIDEO_STYLES: VideoStyle[] = ["unboxing", "demo", "before-after"];
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1920&fit=crop";

function scenesToShotstack(scenes: {
  hook: string;
  pain: string;
  solution: string;
  proof_points?: string[];
  cta: string;
}) {
  const body = [scenes.pain, scenes.solution]
    .concat(scenes.proof_points ?? [])
    .filter(Boolean)
    .join(" ")
    .slice(0, 300)
    .trim() || "Your message";
  return {
    hook: (scenes.hook || "").slice(0, 200).trim() || "Your hook",
    body,
    cta: (scenes.cta || "").slice(0, 150).trim() || "Link in bio",
  };
}

export async function POST(request: Request) {
  const apiKey = getShotstackApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "SHOTSTACK_API_KEY_SANDBOX is not configured. Add it to .env." },
      { status: 503 }
    );
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      productLink,
      productImage,
      productImageBase64,
      productDescription,
      videoStyle,
      platforms,
      targetDurationSec,
      script: providedScript,
    } = body as {
      productLink?: string;
      productImage?: string;
      productImageBase64?: string;
      productDescription?: string;
      videoStyle?: string;
      platforms?: string[];
      targetDurationSec?: number;
      script?: { fullScript: string; scenes: { hook: string; pain: string; solution: string; proof_points?: string[]; cta: string } };
    };

    if (!productLink || typeof productLink !== "string" || !productLink.trim()) {
      return NextResponse.json({ error: "productLink is required" }, { status: 400 });
    }
    const descriptionTrimmed = typeof productDescription === "string" ? productDescription.trim() : "";
    if (!descriptionTrimmed) {
      return NextResponse.json(
        { error: "Product description is required." },
        { status: 400 }
      );
    }

    const style = VIDEO_STYLES.includes(videoStyle as VideoStyle) ? (videoStyle as VideoStyle) : "demo";
    const platformList = Array.isArray(platforms) && platforms.length > 0 ? platforms : ["tiktok"];
    const primaryPlatform = platformList[0];

    let resolvedImageUrl = productImage?.trim() || undefined;
    if (productImageBase64 && typeof productImageBase64 === "string" && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const contentType = productImageBase64.startsWith("data:image/png")
          ? "image/png"
          : productImageBase64.startsWith("data:image/webp")
            ? "image/webp"
            : "image/jpeg";
        resolvedImageUrl = await uploadProductImageToBlob(buffer, contentType);
      } catch (err) {
        return NextResponse.json(
          { error: "Failed to upload product image." },
          { status: 500 }
        );
      }
    }

    const product = await extractProductDetails(productLink.trim(), resolvedImageUrl, descriptionTrimmed);
    const productImageUrl = product.imageUrl?.trim() || resolvedImageUrl || FALLBACK_IMAGE;

    const scriptResult =
      providedScript?.fullScript &&
      providedScript?.scenes?.hook &&
      providedScript?.scenes?.pain &&
      providedScript?.scenes?.solution &&
      providedScript?.scenes?.cta
        ? { fullScript: providedScript.fullScript, scenes: providedScript.scenes }
        : await generateVideoScript({
            productName: product.name,
            productDescription: product.description,
            videoStyle: style,
            platform: primaryPlatform,
            targetDurationSec,
          });

    const shotstackScript = scenesToShotstack(scriptResult.scenes);
    let videoUrl = await renderShotstack(shotstackScript, productImageUrl, apiKey);

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        videoUrl = await uploadVideoFromUrlToBlob(videoUrl);
      } catch (e) {
        console.warn("[generate-video] Blob upload failed:", e);
      }
    }

    for (const platform of platformList) {
      await storeTiktokShopVideo({
        userId,
        productLink: productLink.trim(),
        videoUrl,
        videoStyle: style,
        platform,
      });
    }

    return NextResponse.json({
      videoUrl,
      platform: primaryPlatform,
      platforms: platformList,
      script: { fullScript: scriptResult.fullScript, scenes: scriptResult.scenes },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("[generate-video] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
