import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type TopicItem = {
  id: string;
  title: string;
  hook_angle: string;
  estimated_views: string;
  trend_status: "rising" | "hot" | "evergreen";
  competition: "low" | "medium" | "high";
  why_now: string;
};

type OpenAITopic = {
  title?: string;
  hook_angle?: string;
  estimated_views?: string;
  trend_status?: string;
  competition?: string;
  why_now?: string;
};

function normalizeTrendStatus(s: string | undefined): "rising" | "hot" | "evergreen" {
  if (!s || typeof s !== "string") return "rising";
  const lower = s.trim().toLowerCase();
  if (lower === "hot") return "hot";
  if (lower === "evergreen") return "evergreen";
  return "rising";
}

function normalizeCompetition(s: string | undefined): "low" | "medium" | "high" {
  if (!s || typeof s !== "string") return "medium";
  const lower = s.trim().toLowerCase();
  if (lower === "low") return "low";
  if (lower === "high") return "high";
  return "medium";
}

function mapToTopic(raw: OpenAITopic, index: number): TopicItem {
  return {
    id: `topic-${Date.now()}-${index}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Trending topic",
    hook_angle: typeof raw.hook_angle === "string" && raw.hook_angle.trim() ? raw.hook_angle.trim() : "",
    estimated_views: typeof raw.estimated_views === "string" ? raw.estimated_views : "~200k",
    trend_status: normalizeTrendStatus(raw.trend_status),
    competition: normalizeCompetition(raw.competition),
    why_now: typeof raw.why_now === "string" && raw.why_now.trim() ? raw.why_now.trim() : "",
  };
}

/**
 * POST: Generate 8 trending video topic ideas for a niche.
 * Body: { niche: string, content_style: string, video_type?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const contentStyle = typeof body.content_style === "string" ? body.content_style.trim() : "";
    const videoType = typeof body.video_type === "string" ? body.video_type.trim() : "";

    const contentStyleHint =
      contentStyle && contentStyle.toLowerCase() === "ai-generated"
        ? " Content style is AI-generated: favor topics that work well with AI avatars, voiceovers, and automated video (news, explainers, facts, storytime, motivation, tutorials)."
        : "";

    const prompt = `Generate 8 trending video topic ideas for YouTube in the '${niche || "content creation"}' niche.
Content style: ${contentStyle || "general"}${contentStyleHint}
${videoType ? `Video type: ${videoType}` : ""}

For each topic return:
- title (compelling, clickable)
- hook_angle (the attention-grabbing opener)
- estimated_views (monthly average, e.g. "~200k" or "~1.2M")
- trend_status ("rising" | "hot" | "evergreen")
- competition ("low" | "medium" | "high")
- why_now (1 sentence: why this topic is trending)

Return as JSON array only, no markdown, no explanation:
[{
  "title": "Topic title",
  "hook_angle": "Hook or opener",
  "estimated_views": "~200k",
  "trend_status": "rising",
  "competition": "medium",
  "why_now": "Why this is trending now."
}]`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
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
            {
              role: "system",
              content: "You are a video content strategy expert. Return only valid JSON arrays, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 3000,
        }),
      },
      { onRetry: (attempt, delayMs) => console.log(`[generate-topics] Retry ${attempt} in ${delayMs}ms`) }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-topics] OpenAI error:", response.status, errText);
      return NextResponse.json(
        { error: "Failed to generate topics. Please try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    const raw: OpenAITopic[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    const topics = raw.slice(0, 8).map(mapToTopic);

    return NextResponse.json(topics);
  } catch (err) {
    console.error("[generate-topics]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to generate topics",
      },
      { status: 500 }
    );
  }
}
