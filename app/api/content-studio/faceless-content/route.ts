import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { eq } from "drizzle-orm";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type FacelessPostType =
  | "text-video"     // Dark screen, text appears line by line
  | "product-reveal" // Mockup/product shot with caption
  | "screen-record"  // Screen recording of app/process
  | "quote-card"     // Static image, one quote
  | "teaser";        // "Something is coming" mystery post

export type FacelessPost = {
  day: number;
  platform: "tiktok" | "instagram" | "both";
  type: FacelessPostType;
  hook: string;         // First text on screen / opening line (grabs attention)
  script: string[];     // For text-video: each item = one screen of text (appears sequentially)
  caption: string;      // Post caption (under the video/image)
  hashtags: string[];
  tip: string;          // Production tip — how to actually make this
};

export type FacelessPlan = {
  brandName: string;
  week: number;
  posts: FacelessPost[];
};

type RawPost = {
  day?: number;
  platform?: string;
  type?: string;
  hook?: string;
  script?: string[];
  caption?: string;
  hashtags?: string[];
  tip?: string;
};

function mapPost(raw: RawPost, index: number): FacelessPost {
  const validTypes: FacelessPostType[] = ["text-video", "product-reveal", "screen-record", "quote-card", "teaser"];
  const type = validTypes.includes(raw.type as FacelessPostType) ? (raw.type as FacelessPostType) : "text-video";
  const platform = ["tiktok", "instagram", "both"].includes(raw.platform ?? "") ? (raw.platform as FacelessPost["platform"]) : "both";

  return {
    day: typeof raw.day === "number" ? raw.day : index + 1,
    platform,
    type,
    hook: typeof raw.hook === "string" ? raw.hook.trim() : "",
    script: Array.isArray(raw.script) ? raw.script.filter(Boolean) : [],
    caption: typeof raw.caption === "string" ? raw.caption.trim() : "",
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.filter(Boolean) : [],
    tip: typeof raw.tip === "string" ? raw.tip.trim() : "",
  };
}

/**
 * POST /api/content-studio/faceless-content
 * Body: { brandName?: string; niche?: string; week?: number }
 * Returns a 7-day faceless content plan for TikTok + Instagram.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as {
      brandName?: string;
      niche?: string;
      week?: number;
    };

    // Pull brand name + niche from brand profile if not supplied
    let brandName = (body.brandName ?? "").trim();
    let niche = (body.niche ?? "").trim();

    if (!brandName || !niche) {
      const [row] = await db
        .select({ nicheIndustry: brandProfilesTable.nicheIndustry, brandName: brandProfilesTable.brandName })
        .from(brandProfilesTable)
        .where(eq(brandProfilesTable.userId, userId));
      if (!brandName) brandName = (row?.brandName ?? "").trim();
      if (!niche) niche = (row?.nicheIndustry ?? "").trim();
    }

    if (!brandName) brandName = "My Brand";
    if (!niche) niche = "lifestyle / streetwear brand";

    const week = Math.max(1, Number(body.week) || 1);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

    const prompt = `You are a faceless content strategist for short-form social media (TikTok + Instagram Reels).

Brand: "${brandName}"
Niche: "${niche}"
Week: ${week}

Generate a 7-day faceless content plan. FACELESS means: no face reveal, no talking to camera. Only these formats are allowed:
- text-video: Dark/aesthetic background with text appearing line by line (like motivational quote videos). Best for TikTok.
- product-reveal: Show the product/mockup. No person. Just the item, cinematic reveal.
- screen-record: Screen recording of building/designing/using the app. Process content.
- quote-card: Single quote as a static graphic. Best for Instagram.
- teaser: Mystery/anticipation post. "Something is coming." No context.

Rules:
- Vary the types across the 7 days — don't repeat the same type more than twice
- Day 1 and Day 7 should be high-impact (text-video or teaser)
- At least 1 product-reveal post
- Scripts for text-video should be SHORT — max 4 lines, each line 3-8 words max
- Hooks must stop the scroll — first 1-2 seconds
- Captions should be short, lowercase, brand-voice (minimal, mysterious, premium)
- Hashtags: mix of niche (10K-500K), brand, and broad. Max 8 per post.
- Tips should be practical (e.g. "Use CapCut text reveal template, black background, slow fade in")
- Platform: assign "tiktok", "instagram", or "both" per post

Return ONLY a valid JSON array of 7 posts. No markdown, no code fence.
[{
  "day": 1,
  "platform": "both",
  "type": "text-video",
  "hook": "you're not lost.",
  "script": ["you're not lost.", "you're just building quietly.", "keep going."],
  "caption": "for the ones building in silence. 🖤",
  "hashtags": ["#quietbuilder", "#voidhours", "#buildingmybrand"],
  "tip": "CapCut: black background, white text, slow fade-in between each line. Add low ambient sound."
}]`;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a faceless brand content strategist. Return only valid JSON arrays. No markdown." },
            { role: "user", content: prompt },
          ],
          temperature: 0.85,
          max_tokens: 3000,
        }),
      },
      { onRetry: (a, d) => console.log(`[faceless-content] Retry ${a} in ${d / 1000}s`) }
    );

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "High demand. Try again shortly." }, { status: 429 });
      return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    let jsonText = (data.choices?.[0]?.message?.content ?? "").trim();
    if (jsonText.startsWith("```")) jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = jsonText.match(/\[[\s\S]*\]/);
    const rawPosts: RawPost[] = match ? JSON.parse(match[0]) : [];
    const posts = rawPosts.slice(0, 7).map(mapPost);

    return NextResponse.json({ brandName, niche, week, posts } satisfies FacelessPlan);
  } catch (err) {
    console.error("[content-studio/faceless-content]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate plan" },
      { status: 500 }
    );
  }
}
