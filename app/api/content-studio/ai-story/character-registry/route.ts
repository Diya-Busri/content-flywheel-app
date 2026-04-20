import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { parseCharacterTypes } from "@/lib/ai-story-character-style";

export const dynamic = "force-dynamic";

const STORY_STYLES = ["Brainrot", "Classic Dramatic", "Dark & Twisted", "Wholesome"] as const;

/**
 * POST: Generate a locked visual description per character type for AI Story.
 * Body: { characters, characterNames?, theme?, tone?, style? }
 * Returns { registry: Record<string, string> }
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
    const characterNames =
      typeof body.characterNames === "string" ? body.characterNames.trim() : "";
    const theme = typeof body.theme === "string" ? body.theme.trim() : "";
    const tone =
      typeof body.tone === "string" &&
      ["Sad", "Dramatic", "Shocking"].includes(body.tone)
        ? body.tone
        : "Dramatic";
    const style =
      typeof body.style === "string" &&
      STORY_STYLES.includes(body.style as (typeof STORY_STYLES)[number])
        ? (body.style as (typeof STORY_STYLES)[number])
        : "Brainrot";

    const types = parseCharacterTypes(characters);
    if (types.length === 0) {
      return NextResponse.json(
        { error: "characters must list at least one character type" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const namesLine = characterNames
      ? `Optional dialogue names (map by order to types when present): ${characterNames}`
      : "";

    const systemPrompt = `You define FIXED visual designs for animated story characters. Each description will be copied WORD-FOR-WORD into every scene image prompt — it must be one concrete, repeatable design (not vague).

Output a JSON object with a single key "registry" whose value is an object mapping EACH exact character type string (from the user's list) to ONE detailed English visual description (one long sentence or two short sentences).

Rules:
- Keys MUST match the user's character type strings exactly (same spelling and spacing).
- Each description MUST specify: body shape, face shape, exact eye style (e.g. large white sclera + black pupils), limbs, clothing or "no clothes", and "3D Pixar-style render" (or equivalent). Same vocabulary across characters where applicable so the world feels one art style.
- Example quality for a fruit character named Banana (match this specificity; do not copy if the character is not a banana): "a tall yellow cartoon banana character with a round face, large white eyes with black pupils, small stubby arms, wearing no clothes, 3D Pixar-style render, consistent across all scenes"
- No story plot; appearance only. No character name prefix inside the description string (the app adds the label). No dialogue names in keys — keys are the types (e.g. Banana, Strawberry).
- Non-human cartoon subjects only; no photorealistic humans.

Return only valid JSON, no markdown.`;

    const userPrompt = `Character types (keys): ${types.join(", ")}
${namesLine}
Theme context (for mood only, not plot): ${theme || "(none)"}
Tone: ${tone}
Story style: ${style}

Fill "registry" with one locked visual description per character type.`;

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
          temperature: 0.35,
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
      return NextResponse.json({ error: "No AI response" }, { status: 502 });
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

    const raw = (parsed as { registry?: unknown })?.registry;
    const registry: Record<string, string> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const t of types) {
        const v = (raw as Record<string, unknown>)[t];
        if (typeof v === "string" && v.trim()) registry[t] = v.trim();
      }
    }

    for (const t of types) {
      if (!registry[t]) {
        const kind = t.toLowerCase();
        registry[t] = `a tall stylized 3D cartoon ${kind} character with a round face, large white eyes with black pupils, small stubby limbs, wearing no clothes, 3D Pixar-style render, consistent across all scenes`;
      }
    }

    return NextResponse.json({ registry });
  } catch (e) {
    console.error("[content-studio/ai-story/character-registry]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
