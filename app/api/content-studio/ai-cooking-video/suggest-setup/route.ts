import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

type SuggestBody = {
  dish_name?: string;
  chef_type?: string;
};

function stripJsonFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return t;
}

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

    const body = (await request.json().catch(() => ({}))) as SuggestBody;
    const dish = typeof body.dish_name === "string" ? body.dish_name.trim() : "";
    const chef =
      typeof body.chef_type === "string" ? body.chef_type.trim() : "Home Cook";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    const userBlock =
      dish.length > 0
        ? `Dish focus: "${dish}". Chef persona: ${chef}.`
        : `Chef persona: ${chef}. No specific dish named — suggest a versatile short-form cooking angle that works for trending home recipes.`;

    const prompt = `${userBlock}

Return ONE new creative combo for a vertical short (TikTok/Reels/Shorts) — do not reuse tired defaults like "Cozy Home Kitchen", "Satisfying", or generic "stop scrolling" lines.

Requirements:
- cooking_style: 3–8 words. A specific visual/world angle (e.g. lighting, set, pace, camera language). Must sound distinct each time.
- tone: 1–5 words. Energy for voiceover (not a full sentence).
- opening_hook: One punchy spoken first line for scene 1, max 130 characters. Avoid template phrases like "stop scrolling", "game changer", "wait for it", "you've been doing this wrong", generic curiosity gaps, or "nobody talks about". No quote marks in the string. No hashtags.

Return ONLY valid JSON, one object:
{"cooking_style":"...","tone":"...","opening_hook":"..."}`;

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
            {
              role: "system",
              content:
                "You invent fresh short-form cooking video setup ideas. Output only a single JSON object, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 1.05,
          max_tokens: 400,
        }),
      },
      {
        onRetry: (attempt, delayMs) =>
          console.log(`[ai-cooking-video/suggest-setup] retry ${attempt} in ${delayMs}ms`),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai-cooking-video/suggest-setup] OpenAI:", response.status, errText);
      return NextResponse.json(
        { error: "Could not suggest fresh ideas. Try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsedText = stripJsonFence(content);
    const jsonMatch = parsedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Unexpected AI response. Try again." },
        { status: 502 }
      );
    }

    const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const cooking_style =
      typeof obj.cooking_style === "string" ? obj.cooking_style.trim() : "";
    const tone = typeof obj.tone === "string" ? obj.tone.trim() : "";
    const opening_hook =
      typeof obj.opening_hook === "string" ? obj.opening_hook.trim() : "";

    if (!cooking_style || !tone || !opening_hook) {
      return NextResponse.json(
        { error: "Incomplete suggestion. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ cooking_style, tone, opening_hook });
  } catch (err) {
    console.error("[ai-cooking-video/suggest-setup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
