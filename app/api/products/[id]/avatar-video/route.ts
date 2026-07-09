export const dynamic = "force-dynamic";
/**
 * Avatar Promo Video — Start Generation
 * POST /api/products/[id]/avatar-video
 * Body: { facePresetId?, voiceId?, script?, backgroundPreset?, ttsVoice? }
 *
 * Auto-detects provider from env:
 *   AVATAR_VIDEO_PROVIDER=falai|did|heygen  (explicit)
 *   or auto: FAL_API_KEY → falai, DID_API_KEY → did, HEYGEN_API_KEY → heygen
 *
 * Returns { jobId, provider, script } immediately — client polls /status.
 *
 * GET /api/products/[id]/avatar-video
 * Returns provider info + face/voice options for the picker UI.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { logEvent } from "@/lib/log-event";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { detectProvider } from "@/lib/avatar-video/types";
import { startFalVideo, FAL_FACE_PRESETS, FAL_TTS_VOICES } from "@/lib/avatar-video/fal-provider";
import { startDIDVideo, DID_FACE_PRESETS, DID_VOICES } from "@/lib/avatar-video/did-provider";
import { listAvatars, listVoices, type HeyGenBackgroundPreset } from "@/lib/tiktok-shop/heygen-video";
import { getBrandVoice } from "@/lib/brand-voice";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60; // Audio generation + submit can take ~15s

async function generatePromoScript(
  title: string,
  niche: string,
  format: string,
  brandVoice?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return `Hey! I just found the most amazing resource — "${title}". If you're into ${niche}, this is exactly what you need. Grab it now — link in bio!`;
  }
  const openai = new OpenAI({ apiKey });

  const systemContent = [
    "Write short, punchy, conversational TikTok video scripts. No hashtags. No emojis. Under 75 words. Sound natural and excited.",
    brandVoice ? `\n${brandVoice}` : "",
  ].join("");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 160,
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: `Write a 15-second TikTok promo script for "${title}" — a ${format} about ${niche}. Hook + 2 benefits + CTA. Under 75 words.`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? `Check out "${title}" — the ultimate ${format} for ${niche}. Link in bio!`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const { hasCredits, balance } = await checkVideoCredits("avatarVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need video credits to generate a video.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const { id: productId } = await params;

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const body = await request.json().catch(() => ({})) as {
      facePresetId?: string;
      voiceId?: string;
      ttsVoice?: string;
      script?: string;
      backgroundPreset?: HeyGenBackgroundPreset;
      // HeyGen-specific
      avatarId?: string;
    };

    const title = (product.title ?? "Digital Product").trim();
    const niche = (product.niche ?? "general").trim();
    const format = (product.format ?? "Guide").trim();
    const brandVoice = await getBrandVoice(userId).catch(() => "");
    const script = body.script?.trim() || await generatePromoScript(title, niche, format, brandVoice);

    const provider = detectProvider();
    let result;

    if (provider === "falai") {
      result = await startFalVideo({
        script,
        faceImageUrl: body.facePresetId,  // preset ID or custom URL
        voiceId: body.ttsVoice ?? body.voiceId,
      });
    } else if (provider === "did") {
      result = await startDIDVideo({
        script,
        faceImageUrl: body.facePresetId,
        voiceId: body.voiceId,
      });
    } else {
      // HeyGen fallback
      const { generateAvatarVideo } = await import("@/lib/tiktok-shop/heygen-video");
      // HeyGen is synchronous (polls internally) — wrap in async job
      // We submit and immediately return a synthetic jobId; status route polls HeyGen
      let avatarId = body.avatarId;
      let voiceId = body.voiceId;
      if (!avatarId || !voiceId) {
        const [avatars, voices] = await Promise.all([listAvatars(), listVoices()]);
        if (!avatarId) avatarId = (avatars.find((a) => !a.premium) ?? avatars[0])?.avatar_id;
        if (!voiceId) voiceId = (voices.find((v) => v.language === "en" || v.gender === "female") ?? voices[0])?.voice_id;
      }
      // For HeyGen we can't easily async-ify without a background worker.
      // Store a marker and run synchronously with a long timeout.
      const videoUrl = await generateAvatarVideo({
        script,
        avatarId,
        voiceId,
        backgroundPreset: body.backgroundPreset ?? "office",
        voiceEmotion: "Friendly",
        caption: true,
      });
      // HeyGen completed synchronously — save URL directly
      const currentAssets = (product.marketingAssets ?? {}) as Record<string, unknown>;
      await db.update(productsTable).set({
        marketingAssets: { ...currentAssets, promoVideoUrl: videoUrl, promoVideoStatus: "completed", promoVideoProvider: "heygen" },
        updatedAt: new Date(),
      }).where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
      await deductVideoCredit("avatarVideo").catch((e) => console.error("[avatar-video] credit deduction failed:", e));
      void logEvent(userId, "video_generated", { type: "avatar-video" }).catch(() => {});
      return NextResponse.json({ jobId: "heygen-sync", provider: "heygen", script, videoUrl });
    }

    // Async providers (falai, did): save jobId and return
    const currentAssets = (product.marketingAssets ?? {}) as Record<string, unknown>;
    await db.update(productsTable).set({
      marketingAssets: {
        ...currentAssets,
        promoVideoId: result.jobId,
        promoVideoStatus: "processing",
        promoVideoProvider: provider,
      },
      updatedAt: new Date(),
    }).where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    await deductVideoCredit("avatarVideo").catch((e) => console.error("[avatar-video] credit deduction failed:", e));
      void logEvent(userId, "video_generated", { type: "avatar-video" }).catch(() => {});
    return NextResponse.json({ jobId: result.jobId, provider, script });
  } catch (err) {
    console.error("[avatar-video POST]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start video" }, { status: 500 });
  }
}

/**
 * GET: Return provider info + face/voice picker options for the UI.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const provider = detectProvider();

    if (provider === "falai") {
      const hasKey = Boolean(process.env.FAL_API_KEY?.trim());
      const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
      return NextResponse.json({
        provider: "falai",
        available: hasKey && hasBlob,
        missingEnv: !hasKey ? "FAL_API_KEY" : !hasBlob ? "BLOB_READ_WRITE_TOKEN" : null,
        facePresets: FAL_FACE_PRESETS,
        voices: FAL_TTS_VOICES,
        // No avatars for fal.ai — uses face presets instead
        avatars: [],
      });
    }

    if (provider === "did") {
      const hasKey = Boolean(process.env.DID_API_KEY?.trim());
      return NextResponse.json({
        provider: "did",
        available: hasKey,
        missingEnv: !hasKey ? "DID_API_KEY" : null,
        facePresets: DID_FACE_PRESETS,
        voices: DID_VOICES,
        avatars: [],
      });
    }

    // HeyGen
    const hasKey = Boolean(process.env.HEYGEN_API_KEY?.trim());
    if (!hasKey) {
      return NextResponse.json({ provider: "heygen", available: false, missingEnv: "HEYGEN_API_KEY", avatars: [], voices: [], facePresets: [] });
    }
    try {
      const [avatars, voices] = await Promise.all([listAvatars(), listVoices()]);
      return NextResponse.json({
        provider: "heygen",
        available: true,
        missingEnv: null,
        avatars,
        voices: voices.filter((v) => !v.language || v.language.startsWith("en")).slice(0, 30),
        facePresets: [],
      });
    } catch {
      return NextResponse.json({ provider: "heygen", available: false, missingEnv: null, avatars: [], voices: [], facePresets: [] });
    }
  } catch (err) {
    console.error("[avatar-video GET]", err);
    return NextResponse.json({ provider: "unknown", available: false, avatars: [], voices: [], facePresets: [] });
  }
}
