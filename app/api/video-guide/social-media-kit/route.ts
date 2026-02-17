/**
 * POST /api/video-guide/social-media-kit
 * Requires proof upload (image or video). Saves to Supabase, then generates full Social Media Kit via OpenAI.
 * FormData: file (required), scriptHook, scriptBody, scriptCta, productName, productDescription
 * Returns: { proofUrl, kit }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "proof-images";
const PREFIX = "video-guide-proof/";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"]; // .mov

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

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Form data required" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Upload proof required. Upload a screenshot or video preview to unlock your Social Media Kit." },
        { status: 400 }
      );
    }

    const type = file.type.toLowerCase();
    const isImage = ALLOWED_IMAGE_TYPES.some((t) => type.includes(t));
    const isVideo = ALLOWED_VIDEO_TYPES.some((t) => type.includes(t));
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "Invalid file type. Use .png, .jpg, .mp4, or .mov" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Add Supabase credentials." },
        { status: 503 }
      );
    }

    const ext = isImage
      ? (type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg")
      : type.includes("quicktime") ? "mov" : "mp4";
    const contentType = isImage ? type : type.includes("quicktime") ? "video/quicktime" : "video/mp4";
    const fileName = `${PREFIX}${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType, upsert: false });

    if (uploadError) {
      console.error("[social-media-kit] Supabase upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
    const proofUrl = urlData.publicUrl;

    const scriptHook = (formData.get("scriptHook") as string) ?? "";
    const scriptBody = (formData.get("scriptBody") as string) ?? "";
    const scriptCta = (formData.get("scriptCta") as string) ?? "";
    const productName = (formData.get("productName") as string) ?? "Your product";
    const productDescription = (formData.get("productDescription") as string) ?? "";

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

    return NextResponse.json({ proofUrl, kit });
  } catch (err) {
    console.error("[social-media-kit]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate Social Media Kit" },
      { status: 500 }
    );
  }
}
