import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type DescriptionResult = {
  hook: string;
  summary: string;
  timestamps: string;
  linksPlaceholder: string;
  hashtags: string;
  ctaSuggestions: string[];
  fullDescription: string;
  characterCount: number;
};

const PLATFORM_DESC_LIMITS: Record<string, number> = {
  youtube: 5000,
  tiktok: 150,
  instagram: 2200,
};

/**
 * Extract timestamps from script: look for patterns like "0:00 Intro", "1:23 Topic", "12:34 End".
 * Returns formatted list or empty if none found.
 */
function extractTimestampsFromScript(script: string): string {
  const lines = script.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const timestampRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  const found: { time: string; label: string }[] = [];
  for (const line of lines) {
    const m = line.match(timestampRegex);
    if (m) found.push({ time: m[1], label: m[2] });
  }
  if (found.length === 0) return "";
  return found.map((t) => `${t.time} ${t.label}`).join("\n");
}

/**
 * POST: Generate SEO-optimized description with hook, summary, timestamps (from script if provided), links placeholder, hashtags, CTA.
 * Body: { topic: string, title?: string, script?: string, platform?: "youtube" | "tiktok" | "instagram" }
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

    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const script = typeof body.script === "string" ? body.script.trim() : "";
    const platform = ["youtube", "tiktok", "instagram"].includes(body.platform)
      ? body.platform
      : "youtube";
    const maxChars = PLATFORM_DESC_LIMITS[platform] ?? 5000;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );

    const extractedTimestamps = script ? extractTimestampsFromScript(script) : "";
    const hasScript = script.length > 0;

    const systemPrompt = `You are an expert copywriter for video descriptions. Generate an SEO-optimized description with these sections. Output valid JSON only, no markdown, no explanation.

Required JSON shape:
{
  "hook": "First 2 lines that grab attention (visible above the fold).",
  "summary": "Main content summary with relevant keywords for SEO.",
  "timestamps": "Either use the provided timestamps list exactly, or generate one from the script (format: 0:00 Section name per line). If no script/timestamps provided, leave empty string.",
  "linksPlaceholder": "e.g. 🔗 Links mentioned in this video: [add your links here]",
  "hashtags": "Relevant hashtags for the platform, space or comma separated.",
  "ctaSuggestions": ["Subscribe for more", "Check the link in bio", "Leave a comment with your question", "Turn on notifications"]
}

Rules:
- Total character count must stay under ${maxChars} for ${platform}.
- Hook should be compelling and keyword-rich.
- For YouTube: include timestamps if provided or generated; for TikTok/Instagram keep description shorter.
- CTA suggestions: 3-5 short phrases the creator can use.`;

    let userPrompt = `Video topic: ${topic}`;
    if (title) userPrompt += `\nPreferred title: ${title}`;
    if (hasScript) {
      userPrompt += `\n\nScript (use to generate timestamps if not provided):\n${script.slice(0, 8000)}`;
      if (extractedTimestamps)
        userPrompt += `\n\nExtracted timestamps to use:\n${extractedTimestamps}`;
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
          response_format: { type: "json_object" },
          temperature: 0.6,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: "AI request failed", details: err },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No AI response" },
        { status: 502 }
      );
    }

    let parsed: {
      hook?: string;
      summary?: string;
      timestamps?: string;
      linksPlaceholder?: string;
      hashtags?: string;
      ctaSuggestions?: string[];
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    const hook = typeof parsed.hook === "string" ? parsed.hook.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const timestamps = typeof parsed.timestamps === "string" ? parsed.timestamps.trim() : extractedTimestamps;
    const linksPlaceholder = typeof parsed.linksPlaceholder === "string" ? parsed.linksPlaceholder.trim() : "";
    const hashtags = typeof parsed.hashtags === "string" ? parsed.hashtags.trim() : "";
    const ctaSuggestions = Array.isArray(parsed.ctaSuggestions)
      ? parsed.ctaSuggestions.filter((c) => typeof c === "string").map((c) => String(c).trim()).filter(Boolean)
      : [];

    const parts: string[] = [];
    if (hook) parts.push(hook);
    if (summary) parts.push(summary);
    if (timestamps) parts.push(timestamps);
    if (linksPlaceholder) parts.push(linksPlaceholder);
    if (hashtags) parts.push(hashtags);
    const fullDescription = parts.join("\n\n").slice(0, maxChars);
    const characterCount = fullDescription.length;

    const result: DescriptionResult = {
      hook,
      summary,
      timestamps,
      linksPlaceholder,
      hashtags,
      ctaSuggestions,
      fullDescription,
      characterCount,
    };

    return NextResponse.json({
      description: result,
      platform,
      maxCharacters: maxChars,
    });
  } catch (e) {
    console.error("copy-writer description:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
