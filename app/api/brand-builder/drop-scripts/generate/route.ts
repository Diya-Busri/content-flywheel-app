import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const DROP_TYPES = ["first drop", "restock", "collab", "limited edition"] as const;
const SCRIPT_TYPES = ["Teaser Script", "Countdown Script", "Launch Day Script", "Sold Out/Next Drop Script"] as const;

const SYSTEM =
  "You are a TikTok scriptwriter for aesthetic clothing brands. Write short punchy video scripts. Return ONLY JSON, no markdown.";

function normalizeDropType(t: unknown): string {
  const s = typeof t === "string" ? t.toLowerCase().trim() : "";
  return DROP_TYPES.includes(s as (typeof DROP_TYPES)[number]) ? s : "first drop";
}

/**
 * POST: Generate a drop script by type.
 * Body: { brandName, dropType, vibe, milestone, scriptType }
 * scriptType: "Teaser Script" | "Countdown Script" | "Launch Day Script" | "Sold Out/Next Drop Script"
 * Returns { hook, middle, cta, text_overlays, suggested_audio }
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
    const dropType = normalizeDropType(body.dropType);
    const vibe = typeof body.vibe === "string" ? body.vibe.trim() : "";
    const milestone = typeof body.milestone === "string" ? body.milestone.trim() : "";
    const scriptType = typeof body.scriptType === "string" ? body.scriptType.trim() : SCRIPT_TYPES[0];
    if (!SCRIPT_TYPES.includes(scriptType as (typeof SCRIPT_TYPES)[number])) {
      return NextResponse.json({ error: "Invalid script type" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    const userPrompt = `Brand: ${brandName}. Drop type: ${dropType}. Vibe: ${vibe}.
Milestone: ${milestone || "none"}.
Script type: ${scriptType}.
Return JSON:
{
  "hook": "first 3 seconds exactly what to say/show",
  "middle": "main content 10-15 seconds",
  "cta": "final 3 seconds call to action",
  "text_overlays": ["array of text to show on screen"],
  "suggested_audio": "describe vibe of background music"
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
    const hook = typeof parsed.hook === "string" ? parsed.hook : "";
    const middle = typeof parsed.middle === "string" ? parsed.middle : "";
    const cta = typeof parsed.cta === "string" ? parsed.cta : "";
    const text_overlays = Array.isArray(parsed.text_overlays)
      ? (parsed.text_overlays as unknown[]).map((x) => (typeof x === "string" ? x : String(x)))
      : [];
    const suggested_audio = typeof parsed.suggested_audio === "string" ? parsed.suggested_audio : "";

    return NextResponse.json({
      hook,
      middle,
      cta,
      text_overlays,
      suggested_audio,
    });
  } catch (e) {
    console.error("[brand-builder/drop-scripts/generate]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
