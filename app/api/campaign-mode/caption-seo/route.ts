import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const SYSTEM = "You are a social media SEO copywriter. Return ONLY JSON, no markdown.";

/**
 * POST: Generate caption & SEO copy.
 * Body: brandName, niche, concept, platform
 * Returns { title, description, caption, hashtags, alt_text, best_time_to_post }
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
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const concept = typeof body.concept === "string" ? body.concept.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "TikTok";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const userPrompt = `Brand: ${brandName}. Niche: ${niche}. Concept: ${concept}. Platform: ${platform}.
Return JSON:
{
  "title": "TikTok/Instagram post title max 60 chars",
  "description": "SEO optimised description 150 chars",
  "caption": "engaging caption with CTA 3-4 sentences",
  "hashtags": "20 relevant hashtags as single string",
  "alt_text": "image description for accessibility",
  "best_time_to_post": "suggested time and day"
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
    const title = typeof parsed.title === "string" ? parsed.title : "";
    const description = typeof parsed.description === "string" ? parsed.description : "";
    const caption = typeof parsed.caption === "string" ? parsed.caption : "";
    const hashtags = typeof parsed.hashtags === "string" ? parsed.hashtags : "";
    const alt_text = typeof parsed.alt_text === "string" ? parsed.alt_text : "";
    const best_time_to_post = typeof parsed.best_time_to_post === "string" ? parsed.best_time_to_post : "";

    return NextResponse.json({
      title,
      description,
      caption,
      hashtags,
      alt_text,
      best_time_to_post,
    });
  } catch (e) {
    console.error("[campaign-mode/caption-seo]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
