import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const GOALS = ["Tease product", "Build community", "Drive to store", "Announce drop", "General brand content"] as const;
const FORMATS = ["video", "carousel"] as const;

function normalizeGoal(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return GOALS.includes(s as (typeof GOALS)[number]) ? s : GOALS[0];
}

function normalizeFormat(v: unknown): "video" | "carousel" {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  return FORMATS.includes(s as (typeof FORMATS)[number]) ? (s as "video" | "carousel") : "video";
}

function brandTypeLabel(brandType: string): string {
  const t = brandType.toLowerCase();
  if (t === "digital") return "digital products";
  if (t === "both") return "clothing and digital products";
  return "clothing";
}

/**
 * POST: Generate a single post concept for a campaign.
 * Body: brandName, brandType, aestheticVibe, niche, targetAudience, goal, specificIdea?, format
 * Returns { concept, angle, hook, format_confirmed }
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
    const brandType = typeof body.brandType === "string" ? body.brandType.trim() : "clothing";
    const aestheticVibe = typeof body.aestheticVibe === "string" ? body.aestheticVibe.trim() : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
    const goal = normalizeGoal(body.goal);
    const specificIdea = typeof body.specificIdea === "string" ? body.specificIdea.trim() : "";
    const format = normalizeFormat(body.format);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const typeLabel = brandTypeLabel(brandType);
    const systemPrompt = `You are a social media strategist for a ${typeLabel} brand. Generate a single post concept. Return ONLY JSON.`;
    const formatLabel = format === "video" ? "video" : "carousel";
    const userPrompt = `Brand: ${brandName}. Vibe: ${aestheticVibe}. Niche: ${niche}. Audience: ${targetAudience}. Goal: ${goal}. Format: ${formatLabel}.${specificIdea ? ` Specific idea or direction: ${specificIdea}.` : ""}
Return JSON:
{
  "concept": "one sentence post idea",
  "angle": "why this will resonate with audience",
  "hook": "first 3 seconds to stop the scroll",
  "format_confirmed": "video or carousel"
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
    const concept = typeof parsed.concept === "string" ? parsed.concept : "";
    const angle = typeof parsed.angle === "string" ? parsed.angle : "";
    const hook = typeof parsed.hook === "string" ? parsed.hook : "";
    const format_confirmed = typeof parsed.format_confirmed === "string" ? parsed.format_confirmed : formatLabel;

    return NextResponse.json({
      concept,
      angle,
      hook,
      format_confirmed: format_confirmed.toLowerCase().includes("carousel") ? "carousel" : "video",
    });
  } catch (e) {
    console.error("[campaign-mode/concept/generate]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
