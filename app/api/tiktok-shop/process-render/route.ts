import { NextResponse } from "next/server";
import { db } from "@/db/db";

/** Product-in-hand does DALL-E + HeyGen; can take 5+ min. */
export const maxDuration = 300;
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq } from "drizzle-orm";
import type { VideoStyle } from "@/lib/tiktok-shop/types";
import { extractProductDetails } from "@/lib/tiktok-shop/extract-product";
import { generateVideoScript } from "@/lib/tiktok-shop/generate-script";
import { getVoiceoverBuffer } from "@/lib/tiktok-shop/generate-voiceover";
import { uploadAudioToSupabase } from "@/lib/tiktok-shop/upload-audio";
import { uploadAudioToBlob } from "@/lib/tiktok-shop/upload-audio-blob";
import { uploadProductImageToBlob } from "@/lib/tiktok-shop/upload-product-image-blob";
import { uploadVideoFromUrlToBlob } from "@/lib/tiktok-shop/upload-video-blob";
import { putTemporaryAudio } from "@/lib/tiktok-shop/temporary-audio-store";
import { renderProductVideo } from "@/lib/tiktok-shop/render-video";
import { storeTiktokShopVideo } from "@/lib/tiktok-shop/store-video";
import { generateAvatarVideo } from "@/lib/tiktok-shop/heygen-video";
import { generateProductInHandVideo } from "@/lib/tiktok-shop/product-in-hand-video";

const VIDEO_STYLES: VideoStyle[] = ["unboxing", "demo", "before-after"];
const hasHeyGen = () => Boolean(process.env.HEYGEN_API_KEY?.trim());

/**
 * POST: Internal. Runs video generation and updates render job.
 * Body: jobId, productLink, productDescription, script?, productImageBase64?, videoStyle?, platforms?, voiceId?, targetDurationSec?
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const userId = body.userId as string | undefined;
  const productLink = body.productLink as string | undefined;
  const productDescription = body.productDescription as string | undefined;
  const providedScript = body.script as { fullScript: string; scenes: { hook: string; pain: string; solution: string; proof_points?: string[]; cta: string } } | undefined;
  const avatarId = body.avatarId as string | undefined;
  const heygenVoiceId = body.heygenVoiceId as string | undefined;
  const avatarStyle = body.avatarStyle as "normal" | "circle" | "closeUp" | undefined;
  const backgroundPreset = body.backgroundPreset as string | undefined;
  const voiceEmotion = body.voiceEmotion as string | undefined;
  const presenterStyle = body.presenterStyle as string | undefined;
  const productImageBase64 = body.productImageBase64 as string | undefined;
  const videoStyle = body.videoStyle as string | undefined;
  const platforms = body.platforms as string[] | undefined;
  const voiceId = body.voiceId as string | undefined;
  const targetDurationSec = body.targetDurationSec as number | undefined;

  if (!userId || !productDescription?.trim()) {
    await db.update(renderJobsTable).set({ status: "failed", error: "Missing userId or productDescription", updatedAt: new Date() }).where(eq(renderJobsTable.id, jobId));
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const link = productLink?.trim() || "https://tiktok-shop.local/product";
  const videoBuildMode = body.videoBuildMode as string | undefined;
  const heygenEnabled = hasHeyGen();
  // Respect user choice: ai-avatar, mixed, product-in-hand use HeyGen; others use Creatomate
  const heygenMode =
    heygenEnabled &&
    (videoBuildMode === "ai-avatar" || videoBuildMode === "mixed" || !videoBuildMode);
  const productInHandMode = heygenEnabled && videoBuildMode === "product-in-hand";
  const style = VIDEO_STYLES.includes(videoStyle as VideoStyle) ? (videoStyle as VideoStyle) : "demo";
  const platformList = Array.isArray(platforms) && platforms.length > 0 ? platforms : ["tiktok"];
  const primaryPlatform = platformList[0];

  try {
    console.log("[process-render] Starting job:", jobId, "videoBuildMode:", body.videoBuildMode, "heygenMode:", heygenEnabled);
    let resolvedImageUrl: string | undefined;
    if (productImageBase64 && typeof productImageBase64 === "string" && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const contentType = productImageBase64.startsWith("data:image/png") ? "image/png" : productImageBase64.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
        resolvedImageUrl = await uploadProductImageToBlob(buffer, contentType);
      } catch (e) {
        console.warn("[process-render] Image upload failed:", e);
      }
    }

    const product = await extractProductDetails(link, resolvedImageUrl, productDescription.trim());
    const productImageUrl = product.imageUrl?.trim();

    if (!heygenMode && !productInHandMode && !productImageUrl) {
      await db.update(renderJobsTable).set({ status: "failed", error: "Product image required for product-only videos", updatedAt: new Date() }).where(eq(renderJobsTable.id, jobId));
      return NextResponse.json({ error: "Product image required" }, { status: 400 });
    }

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

    let videoUrl: string;

    if (productInHandMode) {
      const validPresenterStyles = ["young-woman", "young-man", "middle-aged-woman", "middle-aged-man", "diverse"];
      const presenter = presenterStyle && validPresenterStyles.includes(presenterStyle) ? presenterStyle as "young-woman" | "young-man" | "middle-aged-woman" | "middle-aged-man" | "diverse" : undefined;
      console.log("[process-render] HeyGen product-in-hand path | voiceId:", heygenVoiceId, "presenter:", presenter, "scriptLen:", scriptResult.fullScript?.length ?? 0);
      videoUrl = await generateProductInHandVideo({
        productName: product.name,
        productDescription: product.description,
        script: scriptResult.fullScript,
        voiceId: heygenVoiceId ?? undefined,
        presenterStyle: presenter,
        backgroundPreset: backgroundPreset && backgroundPreset !== "product" ? (backgroundPreset as "studio" | "office" | "bedroom" | "gradient" | "warm") : "office",
        voiceEmotion: voiceEmotion && ["Friendly", "Excited", "Soothing", "Serious", "Broadcaster"].includes(voiceEmotion) ? voiceEmotion as "Friendly" | "Excited" | "Soothing" | "Serious" | "Broadcaster" : "Friendly",
      });
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          videoUrl = await uploadVideoFromUrlToBlob(videoUrl);
        } catch (e) {
          console.warn("[process-render] Blob upload failed:", e);
        }
      }
    } else if (heygenMode) {
      const useProductBg = backgroundPreset === "product" && productImageUrl;
      const heygenOpts = {
        avatarId,
        voiceId: heygenVoiceId,
        avatarStyle: avatarStyle ?? "normal",
        backgroundPreset: useProductBg ? "product" : (backgroundPreset ?? "office"),
        scriptLen: scriptResult.fullScript?.length ?? 0,
      };
      console.log("[process-render] HeyGen avatar path | opts:", JSON.stringify(heygenOpts));
      videoUrl = await generateAvatarVideo({
        script: scriptResult.fullScript,
        dimension: { width: 720, height: 1280 },
        caption: true,
        avatarId,
        voiceId: heygenVoiceId,
        avatarStyle: avatarStyle ?? "normal",
        backgroundImageUrl: useProductBg ? productImageUrl : undefined,
        backgroundPreset: !useProductBg && backgroundPreset && backgroundPreset !== "product"
          ? (backgroundPreset as "studio" | "office" | "bedroom" | "gradient" | "warm")
          : undefined,
        voiceEmotion: voiceEmotion && ["Friendly", "Excited", "Soothing", "Serious", "Broadcaster"].includes(voiceEmotion) ? (voiceEmotion as "Friendly" | "Excited" | "Soothing" | "Serious" | "Broadcaster") : "Friendly",
        useAvatarIV: true,
      });
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          videoUrl = await uploadVideoFromUrlToBlob(videoUrl);
        } catch (e) {
          console.warn("[process-render] Blob upload failed:", e);
        }
      }
    } else {
      const buffer = await getVoiceoverBuffer(scriptResult.fullScript, voiceId);
      const key = "voiceover/" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".mp3";
      let voiceoverUrl: string;
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          voiceoverUrl = await uploadAudioToBlob(buffer, "audio/mpeg", key);
        } catch {
          voiceoverUrl = await uploadAudioToSupabase(buffer, "audio/mpeg", key);
        }
      } else {
        const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || "http://localhost:3000";
        if (base && !base.includes("localhost")) {
          const token = putTemporaryAudio(buffer, "audio/mpeg");
          voiceoverUrl = `${base}/api/tiktok-shop/audio/${token}`;
        } else {
          voiceoverUrl = await uploadAudioToSupabase(buffer, "audio/mpeg", key);
        }
      }

      const totalDurationSec = targetDurationSec != null && targetDurationSec >= 15 && targetDurationSec <= 60 ? targetDurationSec : undefined;
      videoUrl = await renderProductVideo({
        scriptScenes: scriptResult.scenes,
        productImageUrl: productImageUrl!,
        voiceoverUrl,
        platform: primaryPlatform,
        fullScript: scriptResult.fullScript,
        fullScriptLength: scriptResult.fullScript.length,
        targetDurationSec: totalDurationSec,
      });
    }

    if (!videoUrl || !videoUrl.startsWith("http")) {
      throw new Error("No usable video URL returned");
    }

    for (const platform of platformList) {
      await storeTiktokShopVideo({ userId, productLink: link, videoUrl, videoStyle: style, platform });
    }

    await db
      .update(renderJobsTable)
      .set({
        status: "completed",
        videoUrl,
        payload: { ...body, script: scriptResult },
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobId));

    return NextResponse.json({ ok: true, videoUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video generation failed";
    const stack = err instanceof Error ? err.stack : undefined;
    const fullErr = err instanceof Error ? err : JSON.stringify(err);
    console.error(
      "[process-render] Error:",
      msg,
      "| jobId:",
      jobId,
      "| videoBuildMode:",
      body.videoBuildMode,
      "| heygenMode:",
      body.videoBuildMode === "ai-avatar" || body.videoBuildMode === "mixed" || body.videoBuildMode === "product-in-hand",
      "\nStack:",
      stack ?? "(none)",
      "\nFull:",
      fullErr
    );
    await db
      .update(renderJobsTable)
      .set({ status: "failed", error: msg, updatedAt: new Date() })
      .where(eq(renderJobsTable.id, jobId));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
