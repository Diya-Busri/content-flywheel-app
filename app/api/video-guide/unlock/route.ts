/**
 * POST /api/video-guide/unlock
 * Upload screenshot of finished content → store in Supabase → generate platform-specific posting assets.
 * Accepts: { imageBase64: string, productName: string, script: { hook, body, cta }, platforms: string[] }
 * Returns: { screenshotUrl: string, postingAssets: Record<platformId, UnlockPlatformAssets> }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { cleanProductTitle } from "@/lib/product-title";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram",
  youtube_shorts: "YouTube Shorts",
  youtube_longform: "YouTube",
  facebook_reels: "Facebook",
  pinterest_video: "Pinterest",
  linkedin_video: "LinkedIn",
  x_video: "X (Twitter)",
};

const BUCKET = "proof-images";
const PREFIX = "guide-unlock/";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const {
      imageBase64,
      productName,
      script,
      platforms,
    } = body as {
      imageBase64?: string;
      productName?: string;
      script?: { hook?: string; body?: string; cta?: string };
      platforms?: string[];
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Add SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL." },
        { status: 503 }
      );
    }

    let base64Data = imageBase64;
    let mediaType = "image/png";
    const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mediaType = dataUrlMatch[1] || "image/png";
      base64Data = dataUrlMatch[2];
    }

    const ext = mediaType.includes("png") ? "png" : mediaType.includes("jpeg") || mediaType.includes("jpg") ? "jpg" : "png";
    const fileName = `${PREFIX}${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(base64Data, "base64");

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: mediaType, upsert: false });

    if (uploadError) {
      console.error("[video-guide/unlock] Supabase upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
    const screenshotUrl = urlData.publicUrl;

    const selectedPlatforms = Array.isArray(platforms) && platforms.length > 0 ? platforms : ["tiktok"];
    const product = productName?.trim() || "Product";
    const hook = script?.hook ?? "";
    const bodyText = script?.body ?? "";
    const cta = script?.cta ?? "";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    let postingAssets: Record<string, { hashtags?: string[]; title?: string; caption?: string; bestPostingTimes?: string; engagementInstructions?: string }> = {};

    if (apiKey) {
      const platformList = selectedPlatforms.map((p) => PLATFORM_LABELS[p] || p).join(", ");
      const prompt = `Product: "${product}"

Script:
- Hook: "${hook}"
- Body: "${(bodyText || "").slice(0, 300)}"
- CTA: "${cta}"

Platforms: ${platformList}

The user has finished creating their content and uploaded a screenshot as proof. Generate optimized POSTING ASSETS for each platform.

For EACH platform in the list, return:
- hashtags: array of 5-15 platform-appropriate hashtags (trending + niche mix for TikTok/IG, SEO keywords for Pinterest, minimal for LinkedIn/X)
- title: optimized title for that platform (e.g. YouTube title, Pinterest pin title)
- caption: full caption/description with CTAs, line breaks where needed, platform-appropriate tone
- bestPostingTimes: when to post on this platform (e.g. "TikTok: 7-9pm Tue-Thu; Instagram: 11am-1pm weekdays")
- engagementInstructions: what to reply to comments, when to follow up, how to drive engagement

Return ONLY this JSON object (no markdown):
{
  "postingAssets": {
    "tiktok": { "hashtags": ["#tag1", "#tag2"], "title": "...", "caption": "...", "bestPostingTimes": "...", "engagementInstructions": "..." },
    "instagram_reels": { ... },
    ...
  }
}

Include ONLY these platform IDs as keys: ${selectedPlatforms.join(", ")}. Be specific to each platform. Output ONLY the JSON object.`;

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
              content: "You generate platform-specific social media posting assets. Return ONLY valid JSON. No markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim() ?? "";
        let jsonStr = content.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed?.postingAssets && typeof parsed.postingAssets === "object") {
            postingAssets = parsed.postingAssets;
          }
        } catch {
          // fallback below
        }
      }
    }

    if (Object.keys(postingAssets).length === 0) {
      selectedPlatforms.forEach((id) => {
        const label = PLATFORM_LABELS[id] || id;
        postingAssets[id] = {
          hashtags: ["#digitalproducts", "#creators", "#sidehustle", "#passiveincome", "#workfromhome"],
          title: `${product} — Check it out`,
          caption: `${hook}\n\n${(bodyText || "").slice(0, 200)}\n\n${cta}`,
          bestPostingTimes: "Post during peak hours: 7-9pm or 11am-1pm",
          engagementInstructions: "Reply to every comment within the first hour. Pin top question. DM links when requested.",
        };
      });
    }

    return NextResponse.json({
      screenshotUrl,
      postingAssets,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unlock failed";
    console.error("[video-guide/unlock]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
