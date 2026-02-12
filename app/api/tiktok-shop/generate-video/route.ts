import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { VideoStyle } from "@/lib/tiktok-shop/types";
import { extractProductDetails } from "@/lib/tiktok-shop/extract-product";
import { generateVideoScript } from "@/lib/tiktok-shop/generate-script";
import { getVoiceoverBuffer } from "@/lib/tiktok-shop/generate-voiceover";
import { uploadAudioToSupabase } from "@/lib/tiktok-shop/upload-audio";
import { uploadAudioToBlob } from "@/lib/tiktok-shop/upload-audio-blob";
import { putTemporaryAudio } from "@/lib/tiktok-shop/temporary-audio-store";
import { renderVideo } from "@/lib/tiktok-shop/render-video";
import { storeTiktokShopVideo } from "@/lib/tiktok-shop/store-video";

const VIDEO_STYLES: VideoStyle[] = ["unboxing", "demo", "before-after"];

export async function POST(request: Request) {
  console.log("[generate-video] POST received");

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
      productDescription,
      videoStyle,
      platforms,
    } = body as {
      productLink?: string;
      productImage?: string;
      productDescription?: string;
      videoStyle?: string;
      platforms?: string[];
    };

    if (!productLink || typeof productLink !== "string" || !productLink.trim()) {
      console.log("[generate-video] Missing productLink");
      return NextResponse.json(
        { error: "productLink is required" },
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

    console.log("[generate-video] Params:", {
      productLink: productLink.slice(0, 60),
      videoStyle: style,
      platforms: platformList,
    });

    const product = await extractProductDetails(
      productLink.trim(),
      productImage?.trim(),
      productDescription?.trim()
    );

    console.log("[generate-video] Product:", { name: product.name });

    const script = await generateVideoScript({
      productName: product.name,
      productDescription: product.description,
      videoStyle: style,
      platform: primaryPlatform,
    });

    const buffer = await getVoiceoverBuffer(script);
    const key = "voiceover/" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".mp3";
    let voiceoverUrl: string;
    // Prefer Vercel Blob when configured (permanent, no Supabase needed)
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
        const base =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : null);
        if (!base) {
          console.error("[generate-video] Supabase failed (no Blob token):", supabaseErr);
          throw supabaseErr instanceof Error
            ? supabaseErr
            : new Error(
                "Audio upload failed. Add Vercel Blob (BLOB_READ_WRITE_TOKEN) for a permanent fix, or fix Supabase."
              );
        }
        const token = putTemporaryAudio(buffer, "audio/mpeg");
        voiceoverUrl = `${base}/api/tiktok-shop/audio/${token}`;
        console.log("[generate-video] Using temporary audio URL");
      }
    }

    const videoUrl = await renderVideo({
      videoStyle: style,
      platform: primaryPlatform,
      productImageUrl: product.imageUrl,
      voiceoverUrl,
      script,
    });

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
