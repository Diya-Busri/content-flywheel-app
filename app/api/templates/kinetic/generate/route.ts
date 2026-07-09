import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      sceneCount?: number;
      colorScheme?: string;
      brandName?: string;
      targetAudience?: string;
      brandStory?: string;
      cta?: string;
      productName?: string;
    };

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const sceneCount = Math.min(Math.max(Number(body.sceneCount) || 12, 6), 30);
    const colorScheme = ["dark-orange", "dark-blue", "dark-green", "dark-purple"].includes(body.colorScheme ?? "")
      ? body.colorScheme!
      : "dark-orange";

    if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

    const brandCtx = body.brandName ? `Brand: "${body.brandName}"` : "";
    const audienceCtx = body.targetAudience ? `Target audience: ${body.targetAudience}` : "";
    const storyCtx = body.brandStory ? `Brand story: ${body.brandStory}` : "";
    const ctaCtx = body.cta || "Follow for more";
    const productCtx = body.productName ? `Product being promoted: ${body.productName}` : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a viral faceless TikTok scriptwriter. You write kinetic typography scripts that appear line by line on a dark screen.

STRUCTURE every script with this arc:
1. HOOK (scenes 1-2): Stop the scroll. Speak directly to the audience's identity or pain. Make them feel seen.
2. STORY (scenes 3-6): Build tension. Tell the brand story or why this matters. Who is this for. What they stand for.
3. VALUE (scenes 7-9): Why they should care. What makes this different. What they're missing.
4. CTA (final 2-3 scenes): Direct, clear call to action. Follow. Shop. Link in bio. Don't be vague.

Rules:
- Each scene is ONE sentence, max 10 words
- Hook MUST be the first line — something that makes the target audience feel "that's me"
- Include the brand name naturally (not forced)
- The CTA must be specific: "Follow @[brand] for the drop" or "Link in bio — dropping [date]"
- accentWords = how many words at the START appear in accent colour (usually 1-3)
- Tone: dark, minimal, confident. Like the brand is talking to exactly one person.`,
        },
        {
          role: "user",
          content: `Write exactly ${sceneCount} kinetic typography scenes for: "${topic}"

${brandCtx}
${audienceCtx}
${storyCtx}
${productCtx}
CTA to use: ${ctaCtx}

Return ONLY valid JSON:
{
  "scenes": [
    { "text": "Short punchy line.", "accentWords": 2 }
  ]
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { scenes?: unknown[] };

    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return NextResponse.json({ error: "AI returned no scenes" }, { status: 500 });
    }

    return NextResponse.json({ topic, colorScheme, scenes: parsed.scenes });
  } catch (err) {
    console.error("[templates/kinetic/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate" },
      { status: 500 }
    );
  }
}
