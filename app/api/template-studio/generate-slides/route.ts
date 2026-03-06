import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const MODE1_TEMPLATE_TYPES = ["quotes", "tips", "affirmations"] as const;
const SLIDE_COUNTS = [5, 10, 20] as const;
const SLIDE_COUNTS_VIRAL = [5, 6, 7, 8, 9, 10] as const;
const POST_GOALS = ["tease drop", "build community", "announce launch", "aesthetic content"] as const;

function normalizeTemplateType(value: string): string {
  const v = value?.toLowerCase().trim();
  return MODE1_TEMPLATE_TYPES.includes(v as (typeof MODE1_TEMPLATE_TYPES)[number]) ? v : "quotes";
}

export type SlideItem = { heading: string; body: string };

/**
 * POST: Generate slide copy (heading + body) for template studio.
 * Body: { mode: "1"|"2"|"3", ...mode-specific fields, count, regenerateIndex? }
 * Returns { slides: [{ heading, body }] }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const mode = ["1", "2", "3", "4", "5", "6"].includes(String(body.mode)) ? String(body.mode) : "1";
    const isViral = mode === "5";
    const count = isViral
      ? (SLIDE_COUNTS_VIRAL.includes(Number(body.count) as (typeof SLIDE_COUNTS_VIRAL)[number])
          ? Number(body.count)
          : 10)
      : (SLIDE_COUNTS.includes(Number(body.count) as (typeof SLIDE_COUNTS)[number])
          ? Number(body.count)
          : 5);
    const regenerateIndex = typeof body.regenerateIndex === "number" && body.regenerateIndex >= 0
      ? body.regenerateIndex
      : undefined;
    const slideCount = regenerateIndex !== undefined ? 1 : count;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "1" || mode === "4") {
      const niche = typeof body.niche === "string" ? body.niche.trim() : "";
      const templateType = normalizeTemplateType(body.templateType ?? (mode === "4" ? "quotes" : "quotes"));
      const templateLabel = templateType.replace(/_/g, " ");
      const nicheLabel = niche || "general";
      systemPrompt = `You are a social media content creator. Generate ${slideCount} short, engaging ${templateLabel} for someone in the ${nicheLabel} niche. ${mode === "4" ? "Focus on motivational, aspirational content." : "Generic shareable content."} Each slide needs: a short heading (max 6 words) and body text (max 20 words). Return a JSON object with a key "slides" that is an array of objects, each with "heading" and "body" strings. Example: { "slides": [{ "heading": "...", "body": "..." }] }. Output only valid JSON, no markdown, no explanation.`;
      userPrompt = `Niche: ${nicheLabel}. Template type: ${templateLabel}. Generate ${slideCount} slide(s).`;
    } else if (mode === "5") {
      const niche = typeof body.niche === "string" ? body.niche.trim() : "";
      const hookAngle = typeof body.hookAngle === "string" ? body.hookAngle.trim() : "Problem/Pain Point";
      const ctaGoal = typeof body.ctaGoal === "string" ? body.ctaGoal.trim() : "Get followers";
      systemPrompt = `You are an expert Instagram growth copywriter. Generate a viral hook carousel for Instagram.

Niche: ${niche || "(not specified)"}
Hook Angle: ${hookAngle}
CTA Goal: ${ctaGoal}
Slides: ${slideCount}

Structure:
1. HOOK (Slide 1): Controversial, bold, stops scroll
2. PROBLEM (Slides 2-3): Amplify pain, call out mistakes
3. SOLUTION (Slides 4-7): Actionable tips, visual examples
4. PROOF (Slides 8-9): Results, authority, social proof
5. CTA (Final slide): Strong call-to-action aligned with goal

Make captions punchy, under 25 words per slide. Use psychology triggers: curiosity, FOMO, social proof. Optimize for saves, shares, and follows.

Return a JSON object with a key "slides" that is an array of objects. Each slide must have: "number" (1-based), "type" (e.g. "hook", "problem", "solution", "proof", "cta"), "caption" (main headline), "subtext" (optional supporting line). If you use "heading" and "body" instead of "caption" and "subtext", that is also accepted. Output only valid JSON, no markdown, no explanation.`;
      userPrompt = `Generate ${slideCount} viral hook carousel slides. Niche: ${niche}. Hook: ${hookAngle}. CTA: ${ctaGoal}.`;
    } else if (mode === "2" || mode === "6") {
      const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
      const whatItDoes = typeof body.productDescription === "string" ? body.productDescription.trim() : "";
      const whoItsFor = typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
      const painPoints = typeof body.painPoints === "string" ? body.painPoints.trim() : "";
      systemPrompt = `You are a social media copywriter creating promotional carousel slides to sell a product or business.

Create ${slideCount} promotional carousel slides for ${brandName || "the brand"}.
It does: ${whatItDoes || "(not specified)"}
For: ${whoItsFor || "(not specified)"}
Pain points it solves: ${painPoints || "(not specified)"}

Each slide = one benefit / pain point / feature. Heading max 6 words. Body max 20 words. Persuasive tone. Return a JSON object with a key "slides" that is an array of objects, each with "heading" and "body" strings. Output only valid JSON, no markdown, no explanation.`;
      userPrompt = `Generate ${slideCount} slide(s). ${mode === "6" ? "Focus on sales/product launch: scarcity, benefits, clear CTA." : ""}`;
    } else {
      const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
      const vibe = typeof body.brandVibe === "string" ? body.brandVibe.trim() : "";
      const postGoal = typeof body.postGoal === "string" ? body.postGoal.trim() : "";
      const goalLabel = postGoal || "aesthetic content";
      systemPrompt = `You are a social media copywriter creating carousel content for a clothing brand.

Create ${slideCount} carousel slides for a clothing brand called ${brandName || "the brand"}.
Aesthetic: ${vibe || "(not specified)"}
Goal: ${goalLabel}

Make it feel intentional, minimal and like it belongs on an aesthetic Instagram page. No generic quotes. Each slide should feel like it belongs to this brand. Heading max 6 words. Body max 20 words. Return a JSON object with a key "slides" that is an array of objects, each with "heading" and "body" strings. Output only valid JSON, no markdown, no explanation.`;
      userPrompt = `Generate ${slideCount} slide(s).`;
    }

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: "AI request failed", details: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No AI response" },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    type RawSlide = { heading?: string; body?: string; caption?: string; subtext?: string };
    let rawSlides: RawSlide[] = [];
    if (Array.isArray(parsed)) {
      rawSlides = parsed as RawSlide[];
    } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { slides?: unknown }).slides)) {
      rawSlides = (parsed as { slides: RawSlide[] }).slides;
    } else if (parsed && typeof parsed === "object" && ("heading" in (parsed as object) || "caption" in (parsed as object))) {
      rawSlides = [parsed as RawSlide];
    }
    const slides: SlideItem[] = rawSlides
      .slice(0, slideCount)
      .map((s) => {
        const heading = typeof s.heading === "string" ? s.heading : (typeof s.caption === "string" ? s.caption : "");
        const body = typeof s.body === "string" ? s.body : (typeof s.subtext === "string" ? s.subtext : "");
        return {
          heading: heading.trim().slice(0, 80),
          body: body.trim().slice(0, 200),
        };
      })
      .filter((s) => s.heading || s.body);

    return NextResponse.json({
      slides,
      regenerateIndex,
    });
  } catch (e) {
    console.error("[template-studio/generate-slides]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
