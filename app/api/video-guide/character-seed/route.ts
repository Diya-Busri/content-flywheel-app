export const dynamic = "force-dynamic";
/**
 * POST /api/video-guide/character-seed
 * One GPT-4o call to derive a locked character description from Scene 1's visual/AI image prompt
 * for consistent DALL·E generations across video guide scenes.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const maxDuration = 60;

const SYSTEM = `You extract a single "locked" character description for AI image generation.

Rules:
- Read the user's scene visual prompt (Scene 1). Identify the main on-camera person or spokesperson if any.
- If there is no person or the scene is product-only / hands-only / environment-only, reply exactly: NONE
- Otherwise output ONE dense paragraph (max 1200 characters) describing ONLY that person so they look identical in every image: apparent age range, skin tone, hair (style, length, color), face shape, eyes, build, clothing and accessories as stated, distinctive marks. Repeat critical traits if needed for consistency.
- Do NOT describe background, room, props except what is worn on the body. Do NOT add a name. Do NOT use bullet points or quotes.
- Plain text only.`;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const scene1ImagePrompt =
      typeof body.scene1ImagePrompt === "string" ? body.scene1ImagePrompt.trim() : "";
    if (!scene1ImagePrompt) {
      return NextResponse.json({ error: "scene1ImagePrompt is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Scene 1 visual / AI image prompt:\n\n${scene1ImagePrompt.slice(0, 12000)}`,
        },
      ],
    });

    let text = response.choices[0]?.message?.content?.trim() ?? "";
    if (/^NONE\s*$/i.test(text)) {
      text = "";
    }
    text = text.replace(/^["']|["']$/g, "").trim();
    if (text.length > 1200) {
      text = text.slice(0, 1197).trimEnd() + "...";
    }

    return NextResponse.json({ characterSeed: text });
  } catch (e) {
    console.error("[video-guide/character-seed]", e);
    const message = e instanceof Error ? e.message : "Character seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
