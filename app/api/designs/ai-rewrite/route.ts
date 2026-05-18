import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const ACTION_PROMPTS: Record<string, (text: string) => string> = {
  viral:        (t) => `Rewrite this text to be more scroll-stopping and shareable on social media. Return ONLY the rewritten text:\n\n"${t}"`,
  hook:         (t) => `Rewrite this as an attention-grabbing social media hook (5–12 words, ALL CAPS). Return ONLY the hook:\n\n"${t}"`,
  luxury:       (t) => `Rewrite this in a premium, aspirational, luxury tone. Return ONLY the rewritten text:\n\n"${t}"`,
  shorten:      (t) => `Shorten this to its essential message. Keep it punchy. Return ONLY the shortened text:\n\n"${t}"`,
  expand:       (t) => `Expand this with more depth and persuasion. Return ONLY the expanded text:\n\n"${t}"`,
  cta:          (t) => `Rewrite this as a compelling call-to-action that starts with an action verb. Return ONLY the CTA:\n\n"${t}"`,
  casual:       (t) => `Rewrite this in a casual, conversational, relatable tone. Return ONLY the rewritten text:\n\n"${t}"`,
  professional: (t) => `Rewrite this in a confident, professional, authoritative tone. Return ONLY the rewritten text:\n\n"${t}"`,
  wellness:     (t) => `Rewrite this in a calm, nurturing, wellness-focused tone. Return ONLY the rewritten text:\n\n"${t}"`,
  motivational: (t) => `Rewrite this as an inspirational and motivational statement. Return ONLY the rewritten text:\n\n"${t}"`,
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({})) as { text?: string; action?: string };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const buildPrompt = ACTION_PROMPTS[action];
  if (!buildPrompt) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: buildPrompt(text) }],
      max_tokens: 300,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: "AI request failed", details: err.slice(0, 200) }, { status: 502 });
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const result = data.choices?.[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ result });
}
