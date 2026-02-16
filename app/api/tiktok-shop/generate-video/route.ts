import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

const VIDEO_STYLES: VideoStyle[] = ["unboxing", "demo", "before-after"];

const hasHeyGen = () => Boolean(process.env.HEYGEN_API_KEY?.trim());

export async function POST(request: Request) {
  console.log("[generate-video] POST received");

  const envKeys = Object.keys(process.env).filter((k) =>
    /ELEVENLABS|CREATOMATE|HEYGEN|BLOB|SUPABASE/.test(k)
  );
  console.log("[generate-video] Env keys present:", envKeys.sort().join(", ") || "(none)");

  const heygenMode = hasHeyGen();

  if (!heygenMode) {
    if (!process.env.ELEVENLABS_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured. Add it to .env.local and restart." },
        { status: 503 }
      );
    }
    if (!process.env.CREATOMATE_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "CREATOMATE_API_KEY is not configured. Add it to your environment." },
        { status: 503 }
      );
    }
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("[generate-video] Unauthorized");
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
      voiceId,
      targetDurationSec,
      script: providedScript,
    } = body as {
      productLink?: string;
      productImage?: string;
      productImageBase64?: string;
      productDescription?: string;
      videoStyle?: string;
      platforms?: string[];
      voiceId?: string;
      targetDurationSec?: number;
      script?: { fullScript: string; scenes: { hook: string; pain: string; solution: string; proof_points?: string[]; cta: string } };
    };

    if (!productLink || typeof productLink !== "string" || !productLink.trim()) {
      return NextResponse.json(
        { error: "productLink is required" },
        { status: 400 }
      );
    }
    const descriptionTrimmed = typeof productDescription === "string" ? productDescription.trim() : "";
    if (!descriptionTrimmed) {
      return NextResponse.json(
        { error: "Product description is required so the script aligns with your product (pain points, solution, CTA)." },
        { status: 400 }
      );
    }

    const style = VIDEO_STYLES.includes(videoStyle as VideoStyle)
      ? (videoStyle as VideoStyle)
      : "demo";
    const platformList = Array.isArray(platforms) && platforms.length > 0
      ? platforms
      : ["tiktok"];
    const primaryPlatform = platformList[0];

    let resolvedImageUrl = productImage?.trim() || undefined;
    if (productImageBase64 && typeof productImageBase64 === "string") {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
          {
            error:
              "Your uploaded image could not be used. Add BLOB_READ_WRITE_TOKEN (Vercel Blob) to .env.local so we can host it, or use a product link that has an image.",
          },
          { status: 503 }
        );
      }
      try {
        const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const contentType = productImageBase64.startsWith("data:image/png")
          ? "image/png"
          : productImageBase64.startsWith("data:image/webp")
            ? "image/webp"
            : "image/jpeg";
        resolvedImageUrl = await uploadProductImageToBlob(buffer, contentType);
        console.log("[generate-video] Uploaded product image to Blob");
      } catch (err) {
        console.error("[generate-video] Product image upload failed:", err);
        return NextResponse.json(
          { error: "Failed to upload your product image. Try a smaller image or different format." },
          { status: 500 }
        );
      }
    }

    console.log("[generate-video] Params:", {
      productLink: productLink.slice(0, 60),
      videoStyle: style,
      platforms: platformList,
      hasImage: !!resolvedImageUrl,
    });

    const product = await extractProductDetails(
      productLink.trim(),
      resolvedImageUrl,
      descriptionTrimmed
    );

    console.log("[generate-video] Product:", { name: product.name, hasImage: !!product.imageUrl });

    const productImageUrl = product.imageUrl?.trim();

    if (!heygenMode && !productImageUrl) {
      return NextResponse.json(
        {
          error:
            "Product image is required for product-only videos. Add a product image above, or use HEYGEN_API_KEY for AI avatar videos.",
        },
        { status: 400 }
      );
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

    if (heygenMode) {
      // HeyGen: AI avatar speaks the script; product image shown as background when available
      console.log("[generate-video] Using HeyGen avatar");
      videoUrl = await generateAvatarVideo({
        script: scriptResult.fullScript,
        dimension: { width: 720, height: 1280 }, // 720p for free plan; paid plans can use 1080x1920
        caption: true,
        backgroundImageUrl: productImageUrl ?? undefined,
      });
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          videoUrl = await uploadVideoFromUrlToBlob(videoUrl);
          console.log("[generate-video] HeyGen video saved to Blob");
        } catch (e) {
          console.warn("[generate-video] Blob upload failed, using HeyGen URL (expires in 7 days):", e);
        }
      }
    } else {
      // Creatomate: product image + voiceover
      const buffer = await getVoiceoverBuffer(scriptResult.fullScript, voiceId);
      const key = "voiceover/" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".mp3";
      let voiceoverUrl: string;
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          voiceoverUrl = await uploadAudioToBlob(buffer, "audio/mpeg", key);
        } catch (blobErr) {
          try {
            voiceoverUrl = await uploadAudioToSupabase(buffer, "audio/mpeg", key);
          } catch {
            throw blobErr instanceof Error ? blobErr : new Error("Audio upload failed");
          }
        }
      } else {
        try {
          voiceoverUrl = await uploadAudioToSupabase(buffer, "audio/mpeg", key);
        } catch (supabaseErr) {
          console.error("[generate-video] Supabase upload failed:", supabaseErr instanceof Error ? supabaseErr.message : supabaseErr);
        const base =
          process.env.NEXT_PUBLIC_APP_URL?.trim() ||
          (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : null) ||
          request.headers.get("origin")?.replace(/\/$/, "") ||
          "http://localhost:3000";
        let baseHost = "localhost";
        try {
          baseHost = new URL(base).hostname;
        } catch {
          // keep localhost
        }
        if (baseHost === "localhost" || baseHost === "127.0.0.1") {
          return NextResponse.json(
            {
              error:
                "Creatomate cannot download audio from localhost. Either add BLOB_READ_WRITE_TOKEN (Vercel Blob) or Supabase storage to .env.local, or for local dev run: npx ngrok http 3000, then set NEXT_PUBLIC_APP_URL to the ngrok https URL in .env.local and restart.",
            },
            { status: 503 }
          );
        }
          const token = putTemporaryAudio(buffer, "audio/mpeg");
          voiceoverUrl = `${base}/api/tiktok-shop/audio/${token}`;
          console.log("[generate-video] Using temporary audio at public base:", base);
        }
      }

      const voiceoverHost = (() => {
        try {
          return new URL(voiceoverUrl).hostname;
        } catch {
          return "";
        }
      })();
      if (voiceoverHost === "localhost" || voiceoverHost === "127.0.0.1") {
        return NextResponse.json(
          {
            error:
              "Voiceover URL is localhost; Creatomate cannot reach it. Set NEXT_PUBLIC_APP_URL to a public URL (e.g. ngrok) or add BLOB_READ_WRITE_TOKEN / Supabase to .env.local.",
          },
          { status: 503 }
        );
      }

      const totalDurationSec =
        targetDurationSec != null && targetDurationSec >= 15 && targetDurationSec <= 60
          ? targetDurationSec
          : undefined;

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

    if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      console.error("[generate-video] Invalid videoUrl returned:", videoUrl);
      return NextResponse.json(
        { error: "Video generation succeeded but no usable URL was returned." },
        { status: 500 }
      );
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

    console.log("[generate-video] Success, videoUrl:", videoUrl);

    return NextResponse.json({
      videoUrl,
      platform: primaryPlatform,
      platforms: platformList,
      script: {
        fullScript: scriptResult.fullScript,
        scenes: scriptResult.scenes,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("[generate-video] Error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
