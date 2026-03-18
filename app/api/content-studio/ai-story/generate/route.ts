import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type AiStoryScene = {
  sceneNumber: number;
  dialogue: string;
  imagePrompt: string;
  motionPrompt: string;
};

/**
 * POST: Generate 8 AI Story scenes using GPT-4o.
 * Body: { characters, theme, tone, episodeNumber }
 * Returns { scenes: AiStoryScene[] }
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
    const characters =
      typeof body.characters === "string" ? body.characters.trim() : "";
    const theme = typeof body.theme === "string" ? body.theme.trim() : "";
    const tone =
      typeof body.tone === "string" &&
      ["Sad", "Dramatic", "Shocking"].includes(body.tone)
        ? body.tone
        : "Dramatic";
    const episodeNumber =
      typeof body.episodeNumber === "number" && body.episodeNumber >= 1
        ? Math.floor(body.episodeNumber)
        : 1;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const systemPrompt = `You are a scriptwriter for short-form AI story episodes. Generate exactly 8 scenes for one episode.

For each scene you must output:
- sceneNumber: 1 through 8
- dialogue: what the narrator or characters say in this scene (1-3 sentences)
- imagePrompt: a detailed image description for generating a still image (visual style, setting, mood, no text)
- motionPrompt: a short description for how the scene could animate or move (e.g. "slow zoom on face", "text fades in")

Return a JSON object with a key "scenes" that is an array of exactly 8 objects, each with: sceneNumber (number), dialogue (string), imagePrompt (string), motionPrompt (string). Output only valid JSON, no markdown, no explanation.`;

    const userPrompt = `Characters: ${characters || "(none specified)"}
Theme: ${theme || "(none specified)"}
Tone: ${tone}
Episode number: ${episodeNumber}

Generate 8 scenes that tell a cohesive micro-story in this tone.`;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
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

    const rawScenes = Array.isArray((parsed as { scenes?: unknown })?.scenes)
      ? (parsed as { scenes: unknown[] }).scenes
      : [];
    const scenes: AiStoryScene[] = rawScenes
      .slice(0, 8)
      .map((s: Record<string, unknown>, i: number) => ({
        sceneNumber:
          typeof s.sceneNumber === "number" && s.sceneNumber >= 1
            ? s.sceneNumber
            : i + 1,
        dialogue:
          typeof s.dialogue === "string" ? String(s.dialogue).trim() : "",
        imagePrompt:
          typeof s.imagePrompt === "string"
            ? String(s.imagePrompt).trim()
            : "",
        motionPrompt:
          typeof s.motionPrompt === "string"
            ? String(s.motionPrompt).trim()
            : "",
      }));

    return NextResponse.json({ scenes });
  } catch (e) {
    console.error("[content-studio/ai-story/generate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
