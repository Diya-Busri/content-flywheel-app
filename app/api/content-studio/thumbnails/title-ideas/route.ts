import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ThumbnailTemplate = "finance" | "gaming" | "vlog" | "education";

const TEMPLATES: ThumbnailTemplate[] = ["finance", "gaming", "vlog", "education"];

/**
 * POST: Generate viral YouTube title ideas from topic.
 * Body: { topic: string, template?: "finance"|"gaming"|"vlog"|"education" }.
 * Returns: { titles: string[] } (10-15 items).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const template =
      typeof body.template === "string" && body.template.trim()
        ? body.template.trim()
        : "vlog";

    if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            `You are a YouTube growth strategist. Output ONLY valid JSON.\n` +
            `Return { "titles": string[] } with 12-15 viral YouTube title options.\n` +
            `Rules:\n` +
            `- Each title must be <= 65 characters.\n` +
            `- Mix patterns: contrarian, how-to, list, curiosity, case study.\n` +
            `- Avoid clickbait lies; promise a clear benefit.\n` +
            `- No quotes, no emojis.\n` +
            `- Make titles specific to the niche.\n`,
        },
        {
          role: "user",
          content: `Topic: ${topic}\nNiche: ${template}\nGenerate titles.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid model response" }, { status: 500 });
    }

    const titlesRaw = (parsed as { titles?: unknown }).titles;
    const titles =
      Array.isArray(titlesRaw)
        ? titlesRaw
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (t.length > 65 ? t.slice(0, 65).trim() : t))
            .slice(0, 15)
        : [];

    if (!titles.length) return NextResponse.json({ error: "No titles generated" }, { status: 500 });

    return NextResponse.json({ titles });
  } catch (err) {
    console.error("[thumbnails/title-ideas]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

