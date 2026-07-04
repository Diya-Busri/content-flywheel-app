import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

const ACTION_PROMPTS: Record<string, string> = {
  "improve-writing": `You are an expert writing coach for creators and founders.
Improve the clarity, flow, sentence structure, and quality of the note below.
Preserve ALL original ideas and meaning — just make the writing sharper and more compelling.
Use the same voice and tone as the original. Remove filler words and redundant phrases.
Return only the improved text — no commentary, no preamble, no explanation.`,

  "expand-idea": `You are an expert content strategist for creators and founders.
Take the note below and expand it into a comprehensive, detailed piece.
Add supporting points, concrete examples, frameworks, and actionable insights.
Structure it well with markdown headings and bullet points where helpful.
Aim for 2-3x the original length. Keep the same voice and focus.
Return only the expanded text — no commentary, no preamble.`,

  "summarise": `You are an expert editor who distils ideas to their essence.
Create a tight, well-structured summary of the note below.
Capture ALL key points and main ideas in a scannable format.
Use a brief intro sentence, then bullet points for the key insights.
Return only the summary — no commentary, no preamble.`,
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;
  const aiRl = checkAiRateLimit(userId);
  if (aiRl) return aiRl;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { action?: string; title?: string; body?: string };
  const { action, title = "", body: noteBody = "" } = body;

  if (!action || !ACTION_PROMPTS[action]) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!noteBody.trim()) {
    return NextResponse.json({ error: "Note is empty" }, { status: 400 });
  }

  const systemPrompt = ACTION_PROMPTS[action];
  const userPrompt = title.trim()
    ? `Title: ${title}\n\n${noteBody}`
    : noteBody;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return NextResponse.json({ error: "AI request failed", details: err }, { status: 502 });
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const result = data.choices?.[0]?.message?.content?.trim() ?? "";

  if (!result) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });

  return NextResponse.json({ result });
}
