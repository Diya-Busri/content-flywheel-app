/**
 * POST /api/video-guide/publishing-kit
 * Generates platform-specific publishing assets for a completed video.
 * FormData: libraryScriptId, scriptHook, scriptBody, scriptCta, productName, productDescription
 * Optional: section — if provided, regenerates only that one section.
 * Returns: { kit: PublishingKit } or { kit: Partial<PublishingKit> } for single-section regen.
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

export type PublishingKit = {
  instagramCaption: string;
  tiktokCaption: string;
  youtubeShortsDescription: string;
  facebookCaption: string;
  linkedinPost: string;
  ctaSuggestions: string[];
  hashtagSets: {
    instagram: string[];
    tiktok: string[];
    youtube: string[];
    general: string[];
  };
  seoTitle: string;
  youtubeKeywords: string[];
};

type SectionKey = keyof PublishingKit;
const VALID_SECTIONS: SectionKey[] = [
  "instagramCaption", "tiktokCaption", "youtubeShortsDescription",
  "facebookCaption", "linkedinPost", "ctaSuggestions",
  "hashtagSets", "seoTitle", "youtubeKeywords",
];

function buildPrompt(
  productName: string,
  productDescription: string,
  scriptHook: string,
  scriptBody: string,
  scriptCta: string,
  section: SectionKey | null
): string {
  const context = `PRODUCT: "${productName}"
${productDescription ? `DESCRIPTION: ${productDescription.slice(0, 400)}` : ""}
SCRIPT:
- Hook: "${scriptHook}"
- Body: "${scriptBody.slice(0, 400)}"
- CTA: "${scriptCta}"`;

  if (section === "instagramCaption") {
    return `${context}

Write a single Instagram Reels caption (200–350 characters) for this short-form video. Open with a bold hook line, 2–3 sentences of value or relatable story, end with a clear CTA. Use line breaks for readability. Return only the caption text, no JSON wrapper.`;
  }
  if (section === "tiktokCaption") {
    return `${context}

Write a single TikTok caption (150–280 characters) for this short-form video. Punchy, conversational, ends with a strong CTA or question. Return only the caption text, no JSON wrapper.`;
  }
  if (section === "youtubeShortsDescription") {
    return `${context}

Write a YouTube Shorts description (3–5 sentences, 300–500 characters) with embedded search keywords. Include what the video is about, who it helps, and a CTA with a placeholder link. Return only the description text, no JSON wrapper.`;
  }
  if (section === "facebookCaption") {
    return `${context}

Write a Facebook caption (100–250 characters) for sharing this video. Warm, community-focused tone, ends with a CTA or question. Return only the caption text, no JSON wrapper.`;
  }
  if (section === "linkedinPost") {
    return `${context}

Write a LinkedIn post (150–300 characters) presenting this video in a thought-leadership tone. Professional, insight-driven, ends with a CTA. Return only the post text, no JSON wrapper.`;
  }
  if (section === "ctaSuggestions") {
    return `${context}

Generate 5 specific, action-oriented CTAs for this video. Each on its own line. No numbering, no JSON. Just the 5 CTAs, one per line.`;
  }
  if (section === "hashtagSets") {
    return `${context}

Return ONLY valid JSON (no markdown, no code fences):
{
  "instagram": ["20 relevant Instagram hashtags — mix of high-volume and niche"],
  "tiktok": ["15 TikTok-specific hashtags"],
  "youtube": ["10 YouTube search-friendly tags"],
  "general": ["10 universal cross-platform hashtags"]
}`;
  }
  if (section === "seoTitle") {
    return `${context}

Write one single SEO-optimised video title (max 60 characters) that would rank well on YouTube Shorts / TikTok search. Return only the title text, no JSON.`;
  }
  if (section === "youtubeKeywords") {
    return `${context}

List 12–15 YouTube search keywords/tags for this video, each 1–4 words, separated by commas. Return only the comma-separated list, no JSON.`;
  }

  // Full kit prompt
  return `You are an expert social media strategist. Generate a complete Publishing Kit for a short-form video based on this product and script. Do NOT generate hooks — those are already in the script.

${context}

Return ONLY valid JSON (no markdown, no code fences):

{
  "instagramCaption": "Single Instagram Reels caption, 200–350 chars. Bold hook line, 2–3 sentences of value/story, clear CTA, line breaks for readability.",
  "tiktokCaption": "Single TikTok caption, 150–280 chars. Punchy, conversational, ends with CTA or question.",
  "youtubeShortsDescription": "YouTube Shorts description, 300–500 chars, 3–5 sentences. Embedded keywords, what the video is about, who it helps, CTA with placeholder link.",
  "facebookCaption": "Facebook caption, 100–250 chars. Warm, community-focused, CTA or question.",
  "linkedinPost": "LinkedIn post, 150–300 chars. Professional, insight-driven, CTA.",
  "ctaSuggestions": ["5 specific action-oriented CTAs"],
  "hashtagSets": {
    "instagram": ["20 Instagram hashtags"],
    "tiktok": ["15 TikTok hashtags"],
    "youtube": ["10 YouTube tags"],
    "general": ["10 universal hashtags"]
  },
  "seoTitle": "One SEO-optimised video title, max 60 chars",
  "youtubeKeywords": ["12–15 YouTube search keywords, 1–4 words each"]
}

Be specific to the product and script. Output ONLY the JSON object.`;
}

function normalizeKit(raw: Partial<PublishingKit>): PublishingKit {
  const hs = (raw.hashtagSets ?? {}) as Partial<PublishingKit["hashtagSets"]>;
  return {
    instagramCaption: typeof raw.instagramCaption === "string" ? raw.instagramCaption : "",
    tiktokCaption: typeof raw.tiktokCaption === "string" ? raw.tiktokCaption : "",
    youtubeShortsDescription: typeof raw.youtubeShortsDescription === "string" ? raw.youtubeShortsDescription : "",
    facebookCaption: typeof raw.facebookCaption === "string" ? raw.facebookCaption : "",
    linkedinPost: typeof raw.linkedinPost === "string" ? raw.linkedinPost : "",
    ctaSuggestions: Array.isArray(raw.ctaSuggestions) ? raw.ctaSuggestions : [],
    hashtagSets: {
      instagram: Array.isArray(hs.instagram) ? hs.instagram : [],
      tiktok: Array.isArray(hs.tiktok) ? hs.tiktok : [],
      youtube: Array.isArray(hs.youtube) ? hs.youtube : [],
      general: Array.isArray(hs.general) ? hs.general : [],
    },
    seoTitle: typeof raw.seoTitle === "string" ? raw.seoTitle : "",
    youtubeKeywords: Array.isArray(raw.youtubeKeywords) ? raw.youtubeKeywords : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Form data required" }, { status: 400 });

    const libraryScriptId = (formData.get("libraryScriptId") as string)?.trim() || null;
    let scriptHook = (formData.get("scriptHook") as string) ?? "";
    let scriptBody = (formData.get("scriptBody") as string) ?? "";
    let scriptCta = (formData.get("scriptCta") as string) ?? "";
    let rawProductName = (formData.get("productName") as string) ?? "";
    let productName = cleanProductTitle(rawProductName) || rawProductName.trim() || "Product";
    let productDescription = (formData.get("productDescription") as string) ?? "";
    const rawSection = (formData.get("section") as string)?.trim() || null;
    const section: SectionKey | null = rawSection && VALID_SECTIONS.includes(rawSection as SectionKey)
      ? (rawSection as SectionKey)
      : null;

    // Load script from DB if libraryScriptId provided
    if (libraryScriptId) {
      const [row] = await db
        .select()
        .from(scriptsTable)
        .where(and(eq(scriptsTable.id, libraryScriptId), eq(scriptsTable.userId, userId), isNull(scriptsTable.deletedAt)))
        .limit(1);
      if (row) {
        let content: { script?: { hook?: string; body?: string; cta?: string }; productName?: string; productDescription?: string } = {};
        try { content = typeof row.content === "string" ? JSON.parse(row.content) : (row.content as typeof content) ?? {}; } catch { /* ignore */ }
        const s = content.script;
        if (!scriptHook && typeof s?.hook === "string") scriptHook = s.hook;
        if (!scriptBody && typeof s?.body === "string") scriptBody = s.body;
        if (!scriptCta && typeof s?.cta === "string") scriptCta = s.cta;
        if (typeof content.productName === "string" && content.productName.trim()) {
          rawProductName = content.productName.trim();
          productName = cleanProductTitle(rawProductName) || rawProductName || "Product";
        }
        if (typeof content.productDescription === "string" && content.productDescription.trim()) {
          productDescription = content.productDescription.trim();
        }
      }
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });

    const prompt = buildPrompt(productName, productDescription, scriptHook, scriptBody, scriptCta, section);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You generate publishing kits for social media videos. When returning JSON, output ONLY valid JSON. No markdown or code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: section ? 800 : 3500,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[publishing-kit] OpenAI error:", res.status, err);
      return NextResponse.json({ error: "Failed to generate Publishing Kit" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (content.startsWith("```")) content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

    // Single-section regen — return just that field
    if (section) {
      if (section === "hashtagSets") {
        try {
          const parsed = JSON.parse(content) as PublishingKit["hashtagSets"];
          return NextResponse.json({ section, value: parsed });
        } catch {
          return NextResponse.json({ error: "Failed to parse hashtag sets" }, { status: 502 });
        }
      }
      if (section === "ctaSuggestions" || section === "youtubeKeywords") {
        // Might be JSON array or newline-separated
        let value: string[] = [];
        try { value = JSON.parse(content) as string[]; } catch {
          value = content.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
        }
        return NextResponse.json({ section, value });
      }
      // Plain text fields
      return NextResponse.json({ section, value: content });
    }

    // Full kit
    let kit: PublishingKit;
    try {
      kit = normalizeKit(JSON.parse(content) as Partial<PublishingKit>);
    } catch {
      console.error("[publishing-kit] Invalid JSON from OpenAI:", content.slice(0, 200));
      return NextResponse.json({ error: "Failed to parse Publishing Kit" }, { status: 502 });
    }

    return NextResponse.json({ kit });
  } catch (err) {
    console.error("[publishing-kit]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate Publishing Kit" }, { status: 500 });
  }
}
