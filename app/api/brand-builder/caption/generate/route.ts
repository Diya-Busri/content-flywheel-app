import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const SYSTEM =
  "You are a social media copywriter for aesthetic clothing brands. Return ONLY JSON, no markdown.";

/**
 * POST: Generate caption, text overlay, hashtags, alt text.
 * Body: { brandName, postConcept, vibe, platform }
 * Returns { caption, text_overlay, hashtags, alt_text }
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
    const postConcept = typeof body.postConcept === "string" ? body.postConcept.trim() : "";
    const vibe = typeof body.vibe === "string" ? body.vibe.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "TikTok";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const userPrompt = `Brand: ${brandName}. Post concept: ${postConcept}. Vibe: ${vibe}. Platform: ${platform}.
Return JSON:
{
  "caption": "engaging 2-3 sentence caption with CTA",
  "text_overlay": "short punchy words for screen max 8 words",
  "hashtags": "20 relevant hashtags as single string",
  "alt_text": "one sentence image description for SEO"
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
    const caption = typeof parsed.caption === "string" ? parsed.caption : "";
    const text_overlay = typeof parsed.text_overlay === "string" ? parsed.text_overlay : "";
    const hashtags = typeof parsed.hashtags === "string" ? parsed.hashtags : "";
    const alt_text = typeof parsed.alt_text === "string" ? parsed.alt_text : "";

    return NextResponse.json({
      caption,
      text_overlay,
      hashtags,
      alt_text,
    });
  } catch (e) {
    console.error("[brand-builder/caption/generate]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
