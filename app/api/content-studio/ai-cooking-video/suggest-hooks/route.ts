import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

type Body = {
  dish_name?: string;
  chef_type?: string;
  cooking_style?: string;
  tone?: string;
};

function stripJsonFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return t;
}

function normalizeHooks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const h = item.replace(/\r?\n/g, " ").trim();
    if (!h || h.length > 160) continue;
    const key = h.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 8) break;
  }
  return out;
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

    const body = (await request.json().catch(() => ({}))) as Body;
    const dish = typeof body.dish_name === "string" ? body.dish_name.trim() : "";
    const chef =
      typeof body.chef_type === "string" ? body.chef_type.trim() : "Home Cook";
    const style =
      typeof body.cooking_style === "string" ? body.cooking_style.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    const contextParts = [
      `Chef: ${chef}.`,
      dish ? `Dish: "${dish}".` : "No dish named — write hooks that still feel specific to viral home cooking shorts.",
      style ? `Visual style: ${style}.` : "",
      tone ? `VO tone: ${tone}.` : "",
    ].filter(Boolean);

    const prompt = `${contextParts.join(" ")}

Write EXACTLY 6 different spoken opening lines for scene 1 of a vertical cooking short (TikTok/Reels).
Each line must feel NEW — avoid clichés like "stop scrolling", "you've been doing this wrong", "game changer", "wait for it", "nobody talks about", "this hack", generic curiosity gaps, or recycled template phrases.
Vary the strategy (sensory, contrarian-but-specific, time pressure, quiet confidence, playful dare, etc.).
Max 125 characters per line. No quotation marks inside lines. No hashtags. No emojis.

Return ONLY valid JSON: {"hooks":["line1","line2","line3","line4","line5","line6"]}`;

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
                "You write sharp first-spoken lines for short cooking videos. Output only valid JSON with a hooks array.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 1.1,
          max_tokens: 500,
        }),
      },
      {
        onRetry: (attempt, delayMs) =>
          console.log(`[ai-cooking-video/suggest-hooks] retry ${attempt} in ${delayMs}ms`),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai-cooking-video/suggest-hooks] OpenAI:", response.status, errText);
      return NextResponse.json(
        { error: "Could not generate hooks. Try again." },
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
    const hooks = normalizeHooks(obj.hooks);
    if (hooks.length < 3) {
      return NextResponse.json(
        { error: "Too few hooks returned. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ hooks });
  } catch (err) {
    console.error("[ai-cooking-video/suggest-hooks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
