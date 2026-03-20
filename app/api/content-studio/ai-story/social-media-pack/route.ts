import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const characters = typeof body.characters === "string" ? body.characters.trim() : "";
    const characterNames = typeof body.characterNames === "string" ? body.characterNames.trim() : "";
    const theme = typeof body.theme === "string" ? body.theme.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";
    const style = typeof body.style === "string" ? body.style.trim() : "";
    const episodeNumber =
      typeof body.episodeNumber === "number" && body.episodeNumber >= 1
        ? Math.floor(body.episodeNumber)
        : 1;
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];

    const normalizedDialogues = scenes
      .map((s) => (typeof s?.dialogue === "string" ? s.dialogue.trim() : ""))
      .filter((s) => s.length > 0)
      .slice(0, 8);

    if (!theme && normalizedDialogues.length === 0) {
      return NextResponse.json(
        { error: "Provide story context (theme and/or scene dialogue)." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a social media copywriter for short-form AI story episodes.

Create a JSON object with:
- caption: punchy 1-2 line TikTok/Instagram caption with emojis
- title: episode title with emojis (e.g. "Episode 1: The Cheating Scandal 🍌🍓")
- hashtags: array of 15-20 relevant hashtags for AI story content
- youtubeDescription: 3-4 sentence summary for YouTube

Rules:
- Hashtags must start with # and have no spaces.
- Keep tone aligned with provided style/tone.
- Avoid markdown and extra keys.

Output valid JSON only.`;

    const userPrompt = `Episode: ${episodeNumber}
Style: ${style || "(unspecified)"}
Tone: ${tone || "(unspecified)"}
Theme: ${theme || "(unspecified)"}
Characters: ${characters || "(unspecified)"}
Character names: ${characterNames || "(unspecified)"}

Scene dialogues:
${normalizedDialogues.map((d, i) => `${i + 1}. ${d}`).join("\n") || "(none provided)"}
`;

    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: "AI request failed", details: err }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "No AI response" }, { status: 502 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 502 });
    }

    const pack = parsed as Record<string, unknown>;
    const hashtags = Array.isArray(pack.hashtags)
      ? pack.hashtags
          .map((h) => (typeof h === "string" ? h.trim() : ""))
          .filter((h) => h.startsWith("#") && h.length > 1)
          .slice(0, 20)
      : [];

    return NextResponse.json({
      socialMediaPack: {
        caption: typeof pack.caption === "string" ? pack.caption.trim() : "",
        title: typeof pack.title === "string" ? pack.title.trim() : "",
        hashtags,
        youtubeDescription:
          typeof pack.youtubeDescription === "string" ? pack.youtubeDescription.trim() : "",
      },
    });
  } catch (e) {
    console.error("[content-studio/ai-story/social-media-pack]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

