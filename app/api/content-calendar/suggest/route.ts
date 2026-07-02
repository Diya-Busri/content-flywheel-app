export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { addDays, format } from "date-fns";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const [bv] = await db
      .select({ brandName: brandVoiceTable.brandName, targetAudience: brandVoiceTable.targetAudience, tone: brandVoiceTable.tone })
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId))
      .limit(1);

    const audience = bv?.targetAudience ?? "content creators";
    const brandName = bv?.brandName ?? "my brand";
    const tone = bv?.tone ?? "energetic";

    const today = new Date();
    const prompt = `You are a content strategist for a short-form video creator.

Creator: ${brandName}
Audience: ${audience}
Tone: ${tone}
Today's date: ${format(today, "yyyy-MM-dd")}

Generate 7 short-form video content ideas for the next 7 days (one per day). Each idea should be scroll-stopping and specific to TikTok/Instagram Reels.

Return ONLY a JSON array with this shape:
[
  {
    "title": "Short punchy video title",
    "hook": "Opening hook line (first 3 seconds)",
    "platform": "tiktok" | "instagram" | "both",
    "suggestedDate": "YYYY-MM-DD"
  }
]

Use dates starting from tomorrow (${format(addDays(today, 1), "yyyy-MM-dd")}) through the next 7 days. Make each idea unique and actionable.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    let ideas: unknown[] = [];
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Accept top-level array or { ideas: [...] }
      if (Array.isArray(parsed)) ideas = parsed;
      else {
        const key = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (key) ideas = parsed[key] as unknown[];
      }
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    return NextResponse.json({ ideas });
  } catch (e) {
    console.error("[content-calendar/suggest]", e);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
