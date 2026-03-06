import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import type { BrandCalendarDay } from "@/db/schema/brand-calendar-schema";

export const dynamic = "force-dynamic";

const SYSTEM = `You are a social media strategist for clothing brands. Generate 7 days of TikTok/Instagram content ideas for a clothing brand. Return ONLY a JSON object with a single key "days" whose value is an array of 7 objects. No markdown.`;

function buildUserPrompt(
  brandName: string,
  vibe: string,
  niche: string,
  platform: string
): string {
  return `Brand: ${brandName}. Aesthetic: ${vibe}. Niche: ${niche}. Platform: ${platform}. Generate 7 days as a JSON object with key "days" and value an array of 7 objects, each with: day (1-7), post_type (e.g. text overlay/mockup reveal/behind scenes), concept (one sentence idea), text_overlay (exact words to show on screen), hook (first 2 seconds of video).`;
}

function parseDaysJson(raw: string): BrandCalendarDay[] {
  const trimmed = raw.trim().replace(/^```json?\s*|\s*```$/g, "");
  const parsed = JSON.parse(trimmed) as unknown;
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "days" in parsed && Array.isArray((parsed as { days: unknown[] }).days)
      ? (parsed as { days: unknown[] }).days
      : [parsed];
  return arr.slice(0, 7).map((item: Record<string, unknown>, i: number) => ({
    day: typeof item.day === "number" ? item.day : i + 1,
    post_type: typeof item.post_type === "string" ? item.post_type : "",
    concept: typeof item.concept === "string" ? item.concept : "",
    text_overlay: typeof item.text_overlay === "string" ? item.text_overlay : "",
    hook: typeof item.hook === "string" ? item.hook : "",
  }));
}

/**
 * POST: Generate 7 days for Content Calendar, or regenerate a single day.
 * Body: { brandName, aestheticVibe, niche, platform, weekNumber, regenerateDayIndex?: number }
 * Returns { days: BrandCalendarDay[] }
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
    const aestheticVibe = typeof body.aestheticVibe === "string" ? body.aestheticVibe.trim() : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "TikTok";
    const weekNumber = Math.min(4, Math.max(1, Number(body.weekNumber) || 1));
    const regenerateDayIndex =
      typeof body.regenerateDayIndex === "number" && body.regenerateDayIndex >= 0 && body.regenerateDayIndex <= 6
        ? body.regenerateDayIndex
        : undefined;
    const existingDays = Array.isArray(body.existingDays) ? body.existingDays : [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const isSingleDay = regenerateDayIndex !== undefined;
    const userPrompt = isSingleDay
      ? `Brand: ${brandName}. Aesthetic: ${aestheticVibe}. Niche: ${niche}. Platform: ${platform}. Generate ONLY 1 day (day ${regenerateDayIndex + 1}) as a single JSON object with keys: day, post_type, concept, text_overlay, hook. Return only that object, no array, no markdown.`
      : buildUserPrompt(brandName, aestheticVibe, niche, platform);

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

    if (isSingleDay) {
      const trimmed = raw.replace(/^```json?\s*|\s*```$/g, "");
      const one = JSON.parse(trimmed) as Record<string, unknown>;
      const newDay: BrandCalendarDay = {
        day: typeof one.day === "number" ? one.day : regenerateDayIndex! + 1,
        post_type: typeof one.post_type === "string" ? one.post_type : "",
        concept: typeof one.concept === "string" ? one.concept : "",
        text_overlay: typeof one.text_overlay === "string" ? one.text_overlay : "",
        hook: typeof one.hook === "string" ? one.hook : "",
      };
      const days = [...existingDays] as BrandCalendarDay[];
      days[regenerateDayIndex!] = newDay;
      return NextResponse.json({ days });
    }

    const days = parseDaysJson(raw);
    return NextResponse.json({ days });
  } catch (e) {
    console.error("[brand-builder/calendar/generate]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
