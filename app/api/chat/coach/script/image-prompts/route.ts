import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type ScenePrompt = { scene_number: number; prompt: string; section_label?: string; animation_style?: string; duration_seconds?: number };

/**
 * POST: Break script into scenes and return one detailed image prompt per scene.
 * Body: { script: string }. Returns { prompts: { scene_number, prompt, section_label? }[] }.
 * All images are 16:9 landscape for YouTube. Section labels include timestamps for video editing.
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
          content: `You are a video director. Generate image prompts ORGANIZED BY SCRIPT SECTIONS with timestamps so users can match images to their video edit. ALL images must be 16:9 LANDSCAPE for YouTube — never square.

OUTPUT FORMAT:
- Parse the script into clear sections (Introduction, Section 1: [topic], Section 2: [topic], etc.) and assign approximate timestamps (e.g. 0:00-0:30, 0:30-2:00, 2:00-3:30) based on typical pacing.
- For each image, provide a "section_label" that shows which script section it belongs to and the time range. Example labels:
  "Introduction (0:00-0:30) - Hook about business models"
  "Section 1: Traditional Models (0:30-2:00)"
  "Section 2: Modern Models (2:00-3:30)"
- Generate one image prompt per distinct visual within that section. Order prompts to follow the script outline.

CONTENT RULES (match script literally, not generic "business vibes"):
- Traditional retail / physical store → retail store interior, checkout, customers
- Manufacturing / factory → factory floor, production line, machinery
- Subscription / SaaS → subscription app interface (e.g. Netflix, Spotify) on screen
- Apple ecosystem → Apple products (iPhone, MacBook, iPad) arranged together
- Cloud storage (e.g. Dropbox) → cloud storage app interface on laptop
- Customer purchase / e-commerce → customer on laptop/phone completing purchase
- Be literal: each prompt must depict the exact concept from the script.

JSON RULES:
- Output valid JSON only, no markdown or extra text.
- Format: { "prompts": [ { "scene_number": 1, "prompt": "detailed description", "section_label": "Introduction (0:00-0:30) - Hook", "animation_style": "slow zoom in", "duration_seconds": 5 }, ... ] }
- Include "animation_style" for each: e.g. "zoom in", "pan left", "fade cut", "ken burns", "static".
- Do NOT include "duration_seconds" — durations are derived from the section timestamps.
- Every prompt must end with: "Photorealistic, professional b-roll style, 16:9 landscape format for YouTube."
- 6-9 prompts when the script has that many distinct sections/concepts. Include section_label for every prompt so users can match images to script timestamps for editing.
- No abstract art, no decorative patterns. All images 16:9 landscape.`,
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

    const B_ROLL_16_9_SUFFIX = " Photorealistic, professional b-roll style, 16:9 landscape format for YouTube.";
    const hasBrollAnd169 = /photorealistic|b-roll|16:9|landscape.*youtube/i;

    const prompts = Array.isArray(parsed.prompts)
      ? (parsed.prompts as ScenePrompt[]).map((p) => {
          let prompt = typeof p.prompt === "string" ? p.prompt.trim() : "";
          if (prompt && !hasBrollAnd169.test(prompt)) prompt = prompt + B_ROLL_16_9_SUFFIX;
          const section_label = typeof (p as ScenePrompt & { section_label?: string }).section_label === "string"
            ? (p as ScenePrompt & { section_label: string }).section_label.trim()
            : undefined;
          const animation_style = typeof (p as ScenePrompt & { animation_style?: string }).animation_style === "string"
            ? (p as ScenePrompt & { animation_style: string }).animation_style.trim() || undefined
            : undefined;
          const duration_seconds = typeof (p as ScenePrompt & { duration_seconds?: number }).duration_seconds === "number"
            ? (p as ScenePrompt & { duration_seconds: number }).duration_seconds
            : undefined;
          return {
            scene_number: typeof p.scene_number === "number" ? p.scene_number : 0,
            prompt,
            ...(section_label ? { section_label } : {}),
            ...(animation_style ? { animation_style } : {}),
            ...(duration_seconds != null ? { duration_seconds } : {}),
          };
        })
      : [];

    return NextResponse.json({ prompts });
  } catch (err) {
    console.error("[chat/coach/script/image-prompts]", err);
    const message = err instanceof Error ? err.message : "Failed to generate prompts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
