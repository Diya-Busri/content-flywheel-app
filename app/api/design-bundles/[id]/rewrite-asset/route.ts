import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

type RewriteAction =
  | "shorter" | "longer" | "more viral" | "more emotional"
  | "more luxury" | "simpler" | "stronger cta" | "more educational";

const ACTION_INSTRUCTIONS: Record<RewriteAction, string> = {
  "shorter":          "Make it shorter — cut to the essential message only. No filler.",
  "longer":           "Expand it — add more context, texture, and personality.",
  "more viral":       "Make it more viral — punchier hook, pattern-interrupt energy, shareable.",
  "more emotional":   "Make it more emotional — tap into feelings, vulnerability, or aspiration.",
  "more luxury":      "Make it more refined and luxurious — premium vocabulary, elegant rhythm.",
  "simpler":          "Make it simpler — plain language, no jargon, anyone can understand it.",
  "stronger cta":     "Strengthen the call-to-action — make it more urgent and specific.",
  "more educational": "Make it more educational — teach something, add structure, share insight.",
};

export async function POST(request: Request, { params: _params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;
  const aiRl = checkAiRateLimit(userId);
  if (aiRl) return aiRl;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    text?: string;
    action?: RewriteAction;
    context?: string;
  };

  const { text, action, context } = body;
  if (!text || !action) return NextResponse.json({ error: "text and action are required" }, { status: 400 });

  const instruction = ACTION_INSTRUCTIONS[action] ?? `Rewrite with this instruction: ${action}`;

  const systemPrompt = `You are a social media copywriter. Rewrite the given text following the instruction exactly.
${context ? `Context: ${context}` : ""}
Return ONLY valid JSON: {"text": "<rewritten text>"}
Preserve the approximate format (caption stays caption, hook stays hook, hashtags stay hashtags).`;

  const userPrompt = `Instruction: ${instruction}\n\nOriginal:\n${text}`;

  try {
    const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "No AI response" }, { status: 502 });

    const parsed = JSON.parse(content) as { text?: string };
    const rewritten = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!rewritten) return NextResponse.json({ error: "Empty rewrite" }, { status: 502 });

    return NextResponse.json({ text: rewritten });
  } catch (e) {
    console.error("[rewrite-asset]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
