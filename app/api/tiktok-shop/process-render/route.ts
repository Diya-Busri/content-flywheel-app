import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq } from "drizzle-orm";
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

/** Shotstack must fetch images from a public URL. localhost, blob:, data: and private URLs will fail. */
function usePublicImageUrl(url: string): string {
  if (!url || typeof url !== "string") return FALLBACK_IMAGE;
  const u = url.trim().toLowerCase();
  if (u.startsWith("blob:") || u.startsWith("data:")) return FALLBACK_IMAGE;
  if (u.includes("localhost") || u.includes("127.0.0.1")) return FALLBACK_IMAGE;
  if (!u.startsWith("https://") && !u.startsWith("http://")) return FALLBACK_IMAGE;
  return url.trim();
}

/** Map script scenes to Shotstack format (hook, body, cta). */
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

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const userId = body.userId as string | undefined;
  const productLink = body.productLink as string | undefined;
  const productDescription = body.productDescription as string | undefined;
  const providedScript = body.script as {
    fullScript: string;
    scenes: { hook: string; pain: string; solution: string; proof_points?: string[]; cta: string };
  } | undefined;
  const productImageBase64 = body.productImageBase64 as string | undefined;
  const videoStyle = body.videoStyle as string | undefined;
  const platforms = body.platforms as string[] | undefined;
  const targetDurationSec = body.targetDurationSec as number | undefined;

  if (!userId || !productDescription?.trim()) {
    await db
      .update(renderJobsTable)
      .set({ status: "failed", error: "Missing userId or productDescription", updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const apiKey = getShotstackApiKey();
  if (!apiKey) {
    await db
      .update(renderJobsTable)
      .set({ status: "failed", error: "SHOTSTACK_API_KEY_SANDBOX is not configured", updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));
    return NextResponse.json(
      { error: "SHOTSTACK_API_KEY_SANDBOX is not configured." },
      { status: 503 }
    );
  }

  const link = productLink?.trim() || "https://tiktok-shop.local/product";
  const style = VIDEO_STYLES.includes(videoStyle as VideoStyle) ? (videoStyle as VideoStyle) : "demo";
  const platformList = Array.isArray(platforms) && platforms.length > 0 ? platforms : ["tiktok"];
  const primaryPlatform = platformList[0];

  try {
    console.log("[process-render] Starting job:", jobId, "| Shotstack");

    let resolvedImageUrl: string | undefined;
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
      } catch (e) {
        console.warn("[process-render] Image upload failed:", e);
      }
    }

    const product = await extractProductDetails(link, resolvedImageUrl, productDescription.trim());
    const rawImageUrl = product.imageUrl?.trim() || resolvedImageUrl || FALLBACK_IMAGE;
    const productImageUrl = usePublicImageUrl(rawImageUrl);

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
    const videoUrl = await renderShotstack(shotstackScript, productImageUrl, apiKey);

    let finalUrl = videoUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        finalUrl = await uploadVideoFromUrlToBlob(videoUrl);
      } catch (e) {
        console.warn("[process-render] Blob upload failed:", e);
      }
    }

    if (!finalUrl || !finalUrl.startsWith("http")) {
      throw new Error("No usable video URL returned");
    }

    for (const platform of platformList) {
      await storeTiktokShopVideo({ userId, productLink: link, videoUrl: finalUrl, videoStyle: style, platform });
    }

    await db
      .update(renderJobsTable)
      .set({
        status: "completed",
        videoUrl: finalUrl,
        payload: { ...body, script: scriptResult },
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobId));

    return NextResponse.json({ ok: true, videoUrl: finalUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video generation failed";
    console.error("[process-render] Error:", msg, "| jobId:", jobId);
    await db
      .update(renderJobsTable)
      .set({ status: "failed", error: msg, updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
