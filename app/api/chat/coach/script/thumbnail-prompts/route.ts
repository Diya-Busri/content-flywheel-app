import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST: Generate 3 thumbnail prompt concepts for a video (for Canva, Midjourney, etc.).
 * Body: { script: string, topic?: string, title?: string }.
 * Returns: { prompts: string[] } (3 prompts).
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
    const topic = typeof (body as { topic?: string }).topic === "string" ? (body as { topic: string }).topic.trim() : "";
    const title = typeof (body as { title?: string }).title === "string" ? (body as { title: string }).title.trim() : "";

    if (!script) return NextResponse.json({ error: "script is required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a thumbnail designer. Given a video script (and optional topic/title), output exactly 3 thumbnail prompt concepts as a JSON object: { "prompts": ["prompt 1", "prompt 2", "prompt 3"] }.

Each prompt should be a detailed 1-2 sentence description for creating a YouTube thumbnail (1280x720). Include: main subject, mood, text overlay suggestion (short phrase), colors/style. Suitable for Canva, Midjourney, or similar. No markdown, valid JSON only.`,
        },
        {
          role: "user",
          content: [topic && `Topic: ${topic}`, title && `Video title: ${title}`, `Script (excerpt):\n\n${script.slice(0, 4000)}`].filter(Boolean).join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "No response from model" }, { status: 500 });

    let parsed: { prompts?: string[] };
    try {
      parsed = JSON.parse(raw) as { prompts?: string[] };
    } catch {
      return NextResponse.json({ error: "Invalid model response" }, { status: 500 });
    }

    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts.filter((p) => typeof p === "string").slice(0, 3) : [];
    return NextResponse.json({ prompts: prompts.length ? prompts : ["No thumbnail prompts generated."] });
  } catch (err) {
    console.error("[chat/coach/script/thumbnail-prompts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Thumbnail prompts failed" }, { status: 500 });
  }
}
