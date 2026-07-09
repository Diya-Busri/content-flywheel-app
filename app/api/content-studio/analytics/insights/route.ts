import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const DEFAULT_INSIGHTS = [
  "Your audience prefers tutorial videos over vlogs.",
  "Post on Tuesdays at 6pm for 40% more views.",
  "Videos under 60s perform 2x better.",
];

type Body = {
  totalViews?: number;
  engagementRate?: string;
  videosPublished?: number;
  bestVideos?: { title: string; platform: string; views: number; engagement: string }[];
  platformBreakdown?: { platform: string; views: number }[];
  growthOverTime?: { month: string; followers: number; subscribers: number }[];
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as Body;
    const totalViews = Number(body.totalViews) || 0;
    const engagementRate = typeof body.engagementRate === "string" ? body.engagementRate : "0";
    const bestVideos = Array.isArray(body.bestVideos) ? body.bestVideos : [];
    const platformBreakdown = Array.isArray(body.platformBreakdown) ? body.platformBreakdown : [];

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ insights: DEFAULT_INSIGHTS });
    }

    const summary = [
      `Total views: ${totalViews.toLocaleString()}`,
      `Engagement rate: ${engagementRate}%`,
      `Top videos: ${bestVideos.slice(0, 5).map((v) => `"${v.title}" (${v.platform}, ${v.views} views)`).join("; ")}`,
      `Platform breakdown: ${platformBreakdown.map((p) => `${p.platform} ${p.views.toLocaleString()} views`).join("; ")}`,
    ].join("\n");

    const prompt = `Based on this creator analytics summary, suggest 3 to 5 short, actionable insights (1 sentence each). Examples of tone:
- "Your audience prefers tutorial videos over vlogs."
- "Post on Tuesdays at 6pm for 40% more views."
- "Videos under 60s perform 2x better."

Summary:
${summary}

Return ONLY a valid JSON array of strings. No markdown, no code fence. Example: ["First insight.","Second insight.","Third insight."]`;

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
              content: "You are a content analytics expert. Return only a valid JSON array of insight strings. No markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.6,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ insights: DEFAULT_INSIGHTS });
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return NextResponse.json({ insights: DEFAULT_INSIGHTS });

    let parsed: unknown;
    try {
      const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ insights: DEFAULT_INSIGHTS });
    }

    const insights: string[] = Array.isArray(parsed)
      ? (parsed as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, 5)
      : DEFAULT_INSIGHTS;

    if (insights.length === 0) return NextResponse.json({ insights: DEFAULT_INSIGHTS });
    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[content-studio/analytics/insights]", err);
    return NextResponse.json({ insights: DEFAULT_INSIGHTS });
  }
}
