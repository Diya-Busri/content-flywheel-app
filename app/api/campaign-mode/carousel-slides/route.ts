import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const SYSTEM = "You are a social media carousel designer for aesthetic brands. Return ONLY JSON, no markdown.";

type CarouselSlide = {
  slide_number: number;
  type: string;
  heading: string;
  body: string;
  design_note: string;
};

function parseSlides(arr: unknown): CarouselSlide[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item: unknown, i: number) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      slide_number: typeof o.slide_number === "number" ? o.slide_number : i + 1,
      type: typeof o.type === "string" ? o.type : "content",
      heading: typeof o.heading === "string" ? o.heading : "",
      body: typeof o.body === "string" ? o.body : "",
      design_note: typeof o.design_note === "string" ? o.design_note : "",
    };
  });
}

/**
 * POST: Generate carousel slides.
 * Body: brandName, vibe, concept, colourPrimary, platform
 * Returns { slides, slide_count }
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
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const vibe = typeof body.vibe === "string" ? body.vibe.trim() : "";
    const concept = typeof body.concept === "string" ? body.concept.trim() : "";
    const colourPrimary = typeof body.colourPrimary === "string" ? body.colourPrimary.trim() : "#000000";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "Instagram";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const userPrompt = `Brand: ${brandName}. Vibe: ${vibe}. Concept: ${concept}. Colour: ${colourPrimary}. Platform: ${platform}.
Return JSON:
{
  "slides": [
    {
      "slide_number": 1,
      "type": "cover/content/cta",
      "heading": "max 6 words",
      "body": "max 20 words",
      "design_note": "layout suggestion"
    }
  ],
  "slide_count": number
}`;

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
            { role: "system", content: SYSTEM },
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
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    const trimmed = raw.replace(/^```json?\s*|\s*```$/g, "");
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const slides = parseSlides(parsed.slides);
    const slide_count = typeof parsed.slide_count === "number" ? parsed.slide_count : slides.length;

    return NextResponse.json({ slides, slide_count });
  } catch (e) {
    console.error("[campaign-mode/carousel-slides]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
