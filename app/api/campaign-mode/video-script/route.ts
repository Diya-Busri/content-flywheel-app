import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const SYSTEM = "You are a faceless TikTok video scriptwriter. Return ONLY JSON, no markdown.";

type Scene = {
  scene_number: number;
  duration_seconds: number;
  visual: string;
  text_overlay: string;
  overlay_timing: string;
  voiceover_line: string;
};

function parseScenes(arr: unknown): Scene[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item: unknown, i: number) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      scene_number: typeof o.scene_number === "number" ? o.scene_number : i + 1,
      duration_seconds: typeof o.duration_seconds === "number" ? o.duration_seconds : 0,
      visual: typeof o.visual === "string" ? o.visual : "",
      text_overlay: typeof o.text_overlay === "string" ? o.text_overlay : "",
      overlay_timing: typeof o.overlay_timing === "string" ? o.overlay_timing : "",
      voiceover_line: typeof o.voiceover_line === "string" ? o.voiceover_line : "",
    };
  });
}

/**
 * POST: Generate video script (full_script, voiceover_text, scenes, suggested_music, total_duration).
 * Body: brandName, vibe, concept, hook, platform
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
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const vibe = typeof body.vibe === "string" ? body.vibe.trim() : "";
    const concept = typeof body.concept === "string" ? body.concept.trim() : "";
    const hook = typeof body.hook === "string" ? body.hook.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "TikTok";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const userPrompt = `Brand: ${brandName}. Vibe: ${vibe}. Concept: ${concept}. Hook: ${hook}. Platform: ${platform}.
Return JSON:
{
  "full_script": "complete word for word voiceover script",
  "voiceover_text": "clean version ready for text to speech",
  "scenes": [
    {
      "scene_number": 1,
      "duration_seconds": 3,
      "visual": "what to show on screen or stock footage keywords",
      "text_overlay": "exact words on screen",
      "overlay_timing": "start and end second",
      "voiceover_line": "what is being said in this scene"
    }
  ],
  "suggested_music": "describe vibe of background audio",
  "total_duration": "estimated seconds"
}`;

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
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
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
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    const trimmed = raw.replace(/^```json?\s*|\s*```$/g, "");
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const full_script = typeof parsed.full_script === "string" ? parsed.full_script : "";
    const voiceover_text = typeof parsed.voiceover_text === "string" ? parsed.voiceover_text : full_script;
    const scenes = parseScenes(parsed.scenes);
    const suggested_music = typeof parsed.suggested_music === "string" ? parsed.suggested_music : "";
    const total_duration = typeof parsed.total_duration === "string" ? parsed.total_duration : "";

    return NextResponse.json({
      full_script,
      voiceover_text,
      scenes,
      suggested_music,
      total_duration,
    });
  } catch (e) {
    console.error("[campaign-mode/video-script]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
