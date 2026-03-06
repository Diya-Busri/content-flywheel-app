import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type ScenePrompt = { scene_number: number; prompt: string };

/**
 * POST: Break script into scenes and return one detailed image prompt per scene.
 * Body: { script: string }. Returns { prompts: { scene_number, prompt }[] }.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const script = typeof (body as { script?: string }).script === "string" ? (body as { script: string }).script.trim() : "";
    if (!script) return NextResponse.json({ error: "script is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a video director. Given a YouTube script, split it into clear visual scenes and output a single detailed image prompt per scene suitable for DALL-E or Midjourney.
Rules:
- Output valid JSON only, no markdown or extra text.
- Format: { "prompts": [ { "scene_number": 1, "prompt": "detailed description for image generation" }, ... ] }
- Each prompt should describe one key visual: setting, mood, subject, style. Be specific (e.g. "A person at a desk with laptop, soft window light, modern office, shallow depth of field").
- One scene per distinct visual moment. Typically 3-10 scenes for a short script.`,
        },
        {
          role: "user",
          content: `Script:\n\n${script.slice(0, 12000)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "No response from model" }, { status: 500 });

    let parsed: { prompts?: ScenePrompt[] };
    try {
      parsed = JSON.parse(raw) as { prompts?: ScenePrompt[] };
    } catch {
      return NextResponse.json({ error: "Invalid model response" }, { status: 500 });
    }

    const prompts = Array.isArray(parsed.prompts)
      ? (parsed.prompts as ScenePrompt[]).map((p) => ({
          scene_number: typeof p.scene_number === "number" ? p.scene_number : 0,
          prompt: typeof p.prompt === "string" ? p.prompt.trim() : "",
        }))
      : [];

    return NextResponse.json({ prompts });
  } catch (err) {
    console.error("[chat/coach/script/image-prompts]", err);
    const message = err instanceof Error ? err.message : "Failed to generate prompts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
