import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import {
  buildSystemPrompt,
  buildUserPrompt,
  VideoAgentInput,
  VideoAgentOutput,
} from "@/lib/video-agent-prompt";

export const dynamic = "force-dynamic";

const OPENAI_MODEL = "gpt-4o";

export async function POST(request: NextRequest) {
  // ── Server-side admin guard ──────────────────────────────────────────────
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Parse + validate input ───────────────────────────────────────────────
  let body: Partial<VideoAgentInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { goal, targetAudience, platform, style, cta } = body;

  if (!goal?.trim() || !targetAudience?.trim() || !platform || !style || !cta?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: goal, targetAudience, platform, style, cta" },
      { status: 400 }
    );
  }

  const validPlatforms = ["TikTok", "Instagram Reels", "YouTube Shorts"];
  const validStyles = ["educational", "pain-point", "demo", "motivational", "direct sales"];

  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: `Invalid platform. Choose: ${validPlatforms.join(", ")}` }, { status: 400 });
  }
  if (!validStyles.includes(style)) {
    return NextResponse.json({ error: `Invalid style. Choose: ${validStyles.join(", ")}` }, { status: 400 });
  }

  const input: VideoAgentInput = {
    goal: goal.trim(),
    targetAudience: targetAudience.trim(),
    platform,
    style,
    cta: cta.trim(),
  };

  // ── Call OpenAI ──────────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  try {
    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[video-agent] OpenAI error", response.status, errText);
      return NextResponse.json(
        { error: `OpenAI error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    let result: VideoAgentOutput;
    try {
      result = JSON.parse(raw);
    } catch {
      console.error("[video-agent] Failed to parse OpenAI JSON", raw);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    // Basic shape validation
    if (!Array.isArray(result.hooks) || !result.script || !Array.isArray(result.scenes)) {
      console.error("[video-agent] Unexpected response shape", result);
      return NextResponse.json({ error: "AI response had unexpected format" }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[video-agent] Unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
