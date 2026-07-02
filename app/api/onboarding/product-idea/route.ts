export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { niche } = await req.json().catch(() => ({})) as { niche?: string };
    if (!niche?.trim()) return NextResponse.json({ error: "niche required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a digital product strategist. Generate one specific, sellable digital product idea for the given niche. Be concrete and specific — not generic. Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Niche: ${niche.trim()}

Return a JSON object with exactly this shape:
{
  "name": "short product name (4-8 words max)",
  "description": "one sentence explaining exactly what it is and who it helps (max 20 words)",
  "format": "one of: eBook, Template Pack, Notion Dashboard, Spreadsheet, Mini Course, Checklist, Planner, Swipe File"
}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.8,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

    let idea: unknown;
    try {
      idea = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ idea: null });
    }

    return NextResponse.json({ idea });
  } catch (err) {
    console.error("[onboarding/product-idea]", err);
    return NextResponse.json({ idea: null });
  }
}
