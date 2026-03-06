import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { brandProfilesTable } from "@/db/schema/brand-profiles-schema";
import { eq } from "drizzle-orm";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type VideoIdeaFilter = "trending" | "evergreen" | "viral" | "beginner";

export type VideoIdea = {
  id: string;
  title: string;
  hook: string;
  whyItWorks: string;
  estViews: string;
  contentStructure?: string;
  psychology?: string;
};

type OpenAIIdea = {
  title?: string;
  hook?: string;
  whyItWorks?: string;
  estViews?: string;
  contentStructure?: string;
  psychology?: string;
};

const FILTER_PROMPTS: Record<VideoIdeaFilter, string> = {
  trending: "Focus on ideas that are hot right now and align with current platform trends and seasonal moments.",
  evergreen: "Focus on timeless ideas that perform well year-round and don't depend on trends.",
  viral: "Focus on ideas with high viral potential: curiosity gaps, controversy, emotion, shareability.",
  beginner: "Focus on ideas that are easy to execute for new creators: simple formats, minimal editing, clear hooks.",
};

function mapToIdea(raw: OpenAIIdea, index: number): VideoIdea {
  return {
    id: `idea-${Date.now()}-${index}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Video idea",
    hook: typeof raw.hook === "string" && raw.hook.trim() ? raw.hook.trim() : "",
    whyItWorks: typeof raw.whyItWorks === "string" && raw.whyItWorks.trim() ? raw.whyItWorks.trim() : "",
    estViews: typeof raw.estViews === "string" && raw.estViews.trim() ? raw.estViews.trim() : "10K–100K",
    contentStructure: typeof raw.contentStructure === "string" && raw.contentStructure.trim() ? raw.contentStructure.trim() : undefined,
    psychology: typeof raw.psychology === "string" && raw.psychology.trim() ? raw.psychology.trim() : undefined,
  };
}

/**
 * POST: Generate video ideas for the user's niche.
 * Body: { niche?: string, filter?: "trending" | "evergreen" | "viral" | "beginner", count?: number }
 * If niche omitted, uses brand profile nicheIndustry.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    let niche = "";
    const body = await request.json().catch(() => ({}));
    if (typeof body.niche === "string" && body.niche.trim()) {
      niche = body.niche.trim();
    } else {
      const [row] = await db
        .select({ nicheIndustry: brandProfilesTable.nicheIndustry })
        .from(brandProfilesTable)
        .where(eq(brandProfilesTable.userId, userId));
      niche = (row?.nicheIndustry ?? "").trim();
    }

    if (!niche) {
      return NextResponse.json(
        { error: "No niche set. Save a niche in Niche Research or pass niche in the request." },
        { status: 400 }
      );
    }

    const filter = ["trending", "evergreen", "viral", "beginner"].includes(body.filter)
      ? body.filter
      : "trending";
    const count = Math.min(20, Math.max(5, Number(body.count) || 20));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const filterInstruction = FILTER_PROMPTS[filter];
    const prompt = `Generate ${count} video ideas for the niche: "${niche}"

Requirements:
- Ideas must be proven to get high engagement (hooks, format, psychology).
- Match current trends where relevant.
- For each idea provide:
  1. title: Clear, clickable video title (under 60 chars)
  2. hook: Opening line or hook example (first 3-5 seconds)
  3. whyItWorks: 1-2 sentences on the psychology/trends/data behind why this works
  4. estViews: Estimated view range (e.g. "50K–200K", "10K–50K")
  5. contentStructure: Optional 1 sentence on structure (intro, main points, CTA)
  6. psychology: Optional 1 sentence on the psychological driver (curiosity, fear of missing out, identity, etc.)

Filter for this batch: ${filterInstruction}

Return ONLY a valid JSON array. No markdown, no code fence.
[{"title":"...","hook":"...","whyItWorks":"...","estViews":"...","contentStructure":"...","psychology":"..."}]`;

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
              content: "You are a viral content strategist. Return only a valid JSON array. No markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 4000,
        }),
      },
      { onRetry: (a, d) => console.log(`[video-ideas] Retry ${a} in ${d / 1000}s`) }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "High demand. Please wait and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "AI request failed. Please try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const match = jsonText.match(/\[[\s\S]*\]/);
    const rawIdeas: OpenAIIdea[] = match ? JSON.parse(match[0]) : [];
    const ideas = rawIdeas.slice(0, count).map(mapToIdea);

    return NextResponse.json({ ideas, niche, filter });
  } catch (err) {
    console.error("[content-studio/video-ideas]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate ideas" },
      { status: 500 }
    );
  }
}
