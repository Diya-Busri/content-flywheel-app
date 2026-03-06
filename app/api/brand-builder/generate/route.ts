import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const TYPES = ["content-calendar", "caption-generator", "drop-scripts", "launch-checklist"] as const;
const PLATFORMS = ["TikTok", "Instagram"] as const;

function normalizeType(t: unknown): (typeof TYPES)[number] {
  const s = typeof t === "string" ? t.toLowerCase().trim() : "";
  return TYPES.includes(s as (typeof TYPES)[number]) ? (s as (typeof TYPES)[number]) : "content-calendar";
}

function normalizePlatform(p: unknown): (typeof PLATFORMS)[number] {
  const s = typeof p === "string" ? p.trim() : "";
  if (s.toLowerCase() === "instagram") return "Instagram";
  return "TikTok";
}

/**
 * POST: Generate Brand Builder content by type.
 * Body: { type, brandName, aestheticVibe, niche, platform }
 * Returns { content: string } (markdown or structured text).
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
    const type = normalizeType(body.type);
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const aestheticVibe = typeof body.aestheticVibe === "string" ? body.aestheticVibe.trim() : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const platform = normalizePlatform(body.platform);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const context = [
      brandName && `Brand: ${brandName}`,
      aestheticVibe && `Aesthetic/vibe: ${aestheticVibe}`,
      niche && `Niche: ${niche}`,
      `Platform: ${platform}`,
    ]
      .filter(Boolean)
      .join(". ");

    let systemPrompt: string;
    let userPrompt: string;

    switch (type) {
      case "content-calendar":
        systemPrompt = `You are a social media strategist. Generate a 30-day content calendar with one post idea per day. For each day output: Day N | Theme/topic | Post idea (1-2 sentences). Keep ideas varied (tips, behind-the-scenes, UGC-style, promos, engagement). Output as clear markdown or plain text with one line per day.`;
        userPrompt = context
          ? `${context}. Generate 30 days of post ideas.`
          : `Generate a 30-day content calendar for ${platform}.`;
        break;
      case "caption-generator":
        systemPrompt = `You are a copywriter for short-form video. For each post generate: (1) Text overlay (short line that appears on screen, 3-7 words). (2) Caption (1-3 sentences for the post description). (3) Hashtags (5-10 relevant hashtags). Output as structured text: for each of 5 post ideas, give "Text overlay:", "Caption:", "Hashtags:" then the content.`;
        userPrompt = context
          ? `${context}. Generate 5 post ideas with text overlay, caption, and hashtags for each.`
          : `Generate 5 post ideas with overlay text, caption, and hashtags for ${platform}.`;
        break;
      case "drop-scripts":
        systemPrompt = `You are a video script writer for product/launch announcements. Write short announcement and tease video scripts (hook + 2-4 lines). Each script should be punchy, platform-native (e.g. TikTok/Reels style). Output 3 scripts: one "Announcement" (full drop), one "Tease 1" (hint only), one "Tease 2" (different angle). For each give a title then the script lines.`;
        userPrompt = context
          ? `${context}. Generate announcement and tease video scripts.`
          : `Generate announcement and tease scripts for ${platform}.`;
        break;
      case "launch-checklist":
        systemPrompt = `You are a launch strategist. Create a launch checklist that includes: (1) POD setup steps (print-on-demand or product-on-demand: store, inventory, fulfillment). (2) Waitlist email sequence (3-5 email subjects + 1-sentence body). (3) Roadmap to first 1k (audience, content, offers, milestones). Use clear headings and bullet points. Output as markdown.`;
        userPrompt = context
          ? `${context}. Generate POD setup steps, waitlist emails, and 1k roadmap.`
          : `Generate a launch checklist: POD setup, waitlist emails, and roadmap to first 1k.`;
        break;
      default:
        systemPrompt = `Generate helpful brand and content strategy content.`;
        userPrompt = context || `Platform: ${platform}.`;
    }

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
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: "AI request failed", details: err },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No content generated. Try again.";

    return NextResponse.json({ content });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    console.error("Brand Builder generate error:", e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
