/**
 * POST /api/video-guide/social-media-kit
 * Unlock via (1) proof: file (image or video) + script/product params, or (2) timeline: libraryScriptId only
 * (when the script has timelineSceneSlots we treat that as proof they used the timeline).
 * FormData: file (optional), libraryScriptId (optional), scriptHook, scriptBody, scriptCta, productName, productDescription
 * Returns: { kit } (Social Media Kit from OpenAI)
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";
import { cleanProductTitle } from "@/lib/product-title";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"]; // .mov
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type SocialMediaKit = {
  tiktok: {
    titleVariations: string[];
    descriptionVariations: string[];
    hashtags: string[];
    bestPostingTimes: string;
    suggestedSounds: string[];
  };
  instagramReels: {
    captionVariations: string[];
    hashtags: string[];
    storySequenceSuggestions: string[];
    bestPostingTimes: string;
  };
  youtubeShorts: {
    titleVariations: string[];
    descriptionWithKeywords: string;
    tagsList: string[];
    thumbnailTextSuggestions: string[];
  };
  general: {
    crossPostingSchedule: string;
    engagementPrompts: string[];
    pinCommentSuggestions: string[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Form data required" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const libraryScriptId = (formData.get("libraryScriptId") as string)?.trim() || null;
    const hasFile = file && file instanceof File && file.size > 0;

    let scriptHook = (formData.get("scriptHook") as string) ?? "";
    let scriptBody = (formData.get("scriptBody") as string) ?? "";
    let scriptCta = (formData.get("scriptCta") as string) ?? "";
    let rawProductName = (formData.get("productName") as string) ?? "";
    let productName = cleanProductTitle(rawProductName) || rawProductName.trim() || "Product";
    let productDescription = (formData.get("productDescription") as string) ?? "";

    // Path 1: Unlock via timeline usage (no file) — load script and require timelineSceneSlots
    if (!hasFile && libraryScriptId) {
      const [row] = await db
        .select()
        .from(scriptsTable)
        .where(
          and(
            eq(scriptsTable.id, libraryScriptId),
            eq(scriptsTable.userId, userId),
            isNull(scriptsTable.deletedAt)
          )
        )
        .limit(1);
      const isVideoGuide = row?.platform === "video-guide" || row?.platform === "content-studio";
      if (!row || !isVideoGuide) {
        return NextResponse.json(
          { error: "Script not found or not a video guide." },
          { status: 404 }
        );
      }
      let content: { script?: { hook?: string; body?: string; cta?: string }; productName?: string; productDescription?: string; timelineSceneSlots?: unknown[] };
      try {
        content = typeof row.content === "string" ? JSON.parse(row.content) : (row.content as typeof content) ?? {};
      } catch {
        return NextResponse.json({ error: "Invalid script content" }, { status: 400 });
      }
      const slots = content.timelineSceneSlots;
      if (!Array.isArray(slots) || slots.length === 0) {
        return NextResponse.json(
          { error: "Use the Video Timeline first to build your video, then you can generate your Social Media Kit here without uploading proof." },
          { status: 400 }
        );
      }
      const script = content.script;
      scriptHook = typeof script?.hook === "string" ? script.hook : scriptHook;
      scriptBody = typeof script?.body === "string" ? script.body : scriptBody;
      scriptCta = typeof script?.cta === "string" ? script.cta : scriptCta;
      if (typeof content.productName === "string" && content.productName.trim()) {
        rawProductName = content.productName.trim();
        productName = cleanProductTitle(rawProductName) || rawProductName || "Product";
      }
      if (typeof content.productDescription === "string" && content.productDescription.trim()) {
        productDescription = content.productDescription.trim();
      }
    } else if (!hasFile) {
      return NextResponse.json(
        { error: "Upload proof required, or open this guide from My Library after using the Video Timeline." },
        { status: 400 }
      );
    } else {
      // Path 2: Unlock via file proof
      const type = (file as File).type.toLowerCase();
      const isImage = ALLOWED_IMAGE_TYPES.some((t) => type.includes(t));
      const isVideo = ALLOWED_VIDEO_TYPES.some((t) => type.includes(t));
      if (!isImage && !isVideo) {
        return NextResponse.json(
          { error: "Invalid file type. Use .png, .jpg, .webp, .mp4, or .mov" },
          { status: 400 }
        );
      }
      if ((file as File).size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File too large. Max ${MAX_FILE_SIZE_MB}MB.` },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const prompt = `You are an expert social media strategist. Generate a complete Social Media Kit for a short-form video (TikTok/Reels/Shorts style) based on this product and script.

PRODUCT: "${productName}"
${productDescription ? `DESCRIPTION: ${productDescription.slice(0, 500)}` : ""}

SCRIPT:
- Hook: "${scriptHook}"
- Body: "${(scriptBody || "").slice(0, 400)}"
- CTA: "${scriptCta}"

The user has uploaded proof they created their video. Generate the following. Return ONLY valid JSON (no markdown, no code fence).

{
  "tiktok": {
    "titleVariations": ["5 optimized title options with emoji for TikTok"],
    "descriptionVariations": ["3 description variations with CTAs"],
    "hashtags": ["30 relevant hashtags - mix of high-volume and niche"],
    "bestPostingTimes": "When to post on TikTok (specific days/times)",
    "suggestedSounds": ["3-5 trending/suggested sounds or audio styles"]
  },
  "instagramReels": {
    "captionVariations": ["5 longer-form caption options with storytelling"],
    "hashtags": ["30 Instagram-specific hashtags"],
    "storySequenceSuggestions": ["3-5 story ideas to tease the reel before posting"],
    "bestPostingTimes": "Best times for Instagram Reels"
  },
  "youtubeShorts": {
    "titleVariations": ["5 SEO-optimized title variations for Shorts"],
    "descriptionWithKeywords": "Full description with keywords for SEO",
    "tagsList": ["list", "of", "relevant", "tags"],
    "thumbnailTextSuggestions": ["3-5 short text ideas for thumbnail"]
  },
  "general": {
    "crossPostingSchedule": "Which platform to post first, timing between posts (e.g. TikTok first, then Reels 2h later, Shorts next day)",
    "engagementPrompts": ["5-7 questions or prompts to put in comments to boost engagement"],
    "pinCommentSuggestions": ["2-3 suggested pin comments"]
  }
}

Be specific to the product and script. Output ONLY the JSON object.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You generate social media kits. Return ONLY valid JSON. No markdown or code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[social-media-kit] OpenAI error:", res.status, err);
      return NextResponse.json(
        { error: "Failed to generate Social Media Kit" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let kit: SocialMediaKit;
    try {
      kit = JSON.parse(content) as SocialMediaKit;
    } catch {
      console.error("[social-media-kit] Invalid JSON from OpenAI");
      return NextResponse.json(
        { error: "Failed to parse Social Media Kit" },
        { status: 502 }
      );
    }

    // Normalize to expected shape
    kit = {
      tiktok: {
        titleVariations: Array.isArray(kit.tiktok?.titleVariations) ? kit.tiktok.titleVariations : [],
        descriptionVariations: Array.isArray(kit.tiktok?.descriptionVariations) ? kit.tiktok.descriptionVariations : [],
        hashtags: Array.isArray(kit.tiktok?.hashtags) ? kit.tiktok.hashtags : [],
        bestPostingTimes: typeof kit.tiktok?.bestPostingTimes === "string" ? kit.tiktok.bestPostingTimes : "",
        suggestedSounds: Array.isArray(kit.tiktok?.suggestedSounds) ? kit.tiktok.suggestedSounds : [],
      },
      instagramReels: {
        captionVariations: Array.isArray(kit.instagramReels?.captionVariations) ? kit.instagramReels.captionVariations : [],
        hashtags: Array.isArray(kit.instagramReels?.hashtags) ? kit.instagramReels.hashtags : [],
        storySequenceSuggestions: Array.isArray(kit.instagramReels?.storySequenceSuggestions) ? kit.instagramReels.storySequenceSuggestions : [],
        bestPostingTimes: typeof kit.instagramReels?.bestPostingTimes === "string" ? kit.instagramReels.bestPostingTimes : "",
      },
      youtubeShorts: {
        titleVariations: Array.isArray(kit.youtubeShorts?.titleVariations) ? kit.youtubeShorts.titleVariations : [],
        descriptionWithKeywords: typeof kit.youtubeShorts?.descriptionWithKeywords === "string" ? kit.youtubeShorts.descriptionWithKeywords : "",
        tagsList: Array.isArray(kit.youtubeShorts?.tagsList) ? kit.youtubeShorts.tagsList : [],
        thumbnailTextSuggestions: Array.isArray(kit.youtubeShorts?.thumbnailTextSuggestions) ? kit.youtubeShorts.thumbnailTextSuggestions : [],
      },
      general: {
        crossPostingSchedule: typeof kit.general?.crossPostingSchedule === "string" ? kit.general.crossPostingSchedule : "",
        engagementPrompts: Array.isArray(kit.general?.engagementPrompts) ? kit.general.engagementPrompts : [],
        pinCommentSuggestions: Array.isArray(kit.general?.pinCommentSuggestions) ? kit.general.pinCommentSuggestions : [],
      },
    };

    return NextResponse.json({ kit });
  } catch (err) {
    console.error("[social-media-kit]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate Social Media Kit" },
      { status: 500 }
    );
  }
}
