import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

const ACTION_PROMPTS: Record<string, string> = {
  "fix-grammar": `You are an expert editor. Fix all grammar, spelling, punctuation, and sentence structure errors in the text below.
Do not change the meaning, voice, or style — only correct mistakes.
Return only the corrected text — no commentary, no preamble.`,

  "improve-writing": `You are an expert writing coach for creators and founders.
Improve the clarity, flow, sentence structure, and quality of the note below.
Preserve ALL original ideas and meaning — just make the writing sharper and more compelling.
Use the same voice and tone as the original. Remove filler words and redundant phrases.
Return only the improved text — no commentary, no preamble, no explanation.`,

  "continue-writing": `You are an expert ghostwriter for creators and founders.
The text below is a note that has been cut off or left incomplete. Continue writing from exactly where it ends.
Match the existing voice, tone, and style perfectly. Do not repeat or summarise what was already written — just continue naturally.
Write 2-4 paragraphs of continuation. Return only the new continuation text — no commentary, no preamble.`,

  "rewrite": `You are an expert ghostwriter for creators and founders.
Completely rewrite the text below from scratch while preserving the same core ideas.
Use fresh wording, a different structure, and more engaging framing.
Keep the same voice and intended audience. Aim for roughly the same length.
Return only the rewritten text — no commentary, no preamble.`,

  "expand-idea": `You are an expert content strategist for creators and founders.
Take the note below and expand it into a comprehensive, detailed piece.
Add supporting points, concrete examples, frameworks, and actionable insights.
Structure it well with markdown headings and bullet points where helpful.
Aim for 2-3x the original length. Keep the same voice and focus.
Return only the expanded text — no commentary, no preamble.`,

  "shorten": `You are an expert editor. Make the text below significantly shorter — cut it to about half the length.
Remove filler, redundancy, and weaker points. Keep only the most important ideas, expressed concisely.
Preserve the core meaning and voice. Do not add any new content.
Return only the shortened text — no commentary, no preamble.`,

  "summarise": `You are an expert editor who distils ideas to their essence.
Create a tight, well-structured summary of the note below.
Capture ALL key points and main ideas in a scannable format.
Use a brief intro sentence, then bullet points for the key insights.
Return only the summary — no commentary, no preamble.`,

  "change-tone": `You are an expert copywriter. Rewrite the text below in a warmer, more conversational tone.
Make it feel like the author is speaking directly to a friend — approachable, confident, and human.
Remove jargon and overly formal language. Keep all the key ideas intact.
Return only the rewritten text — no commentary, no preamble.`,

  "extract-action-items": `You are an expert productivity coach. Read the note below and extract every action item, task, or next step mentioned — both explicit and implied.
Format them as a clean, numbered to-do list. Each item should start with an action verb and be specific enough to act on immediately.
Group related items if helpful. Return only the action items list — no commentary, no preamble.`,

  "turn-into-blog-post": `You are an expert content writer for creators and founders.
Transform the note below into a well-structured, engaging blog post ready to publish.
Add a compelling intro, develop each idea with examples, and end with a clear conclusion or call to action.
Use headers (##), bullet points where helpful, and a conversational yet authoritative tone.
Aim for 500-800 words. Return only the blog post — no commentary, no preamble.`,

  "turn-into-email": `You are an expert email copywriter. Transform the note below into a professional, engaging email.
Include: a clear subject line (as the first line, prefixed with "Subject:"), a warm greeting, a concise body that gets to the point quickly, and a clear call to action or closing.
Keep it scannable — use short paragraphs. Match the original intent and voice.
Return only the email — no commentary, no preamble.`,

  "turn-into-thread": `You are an expert social media writer. Transform the note below into a punchy X/Twitter thread.
Format: start with a hook tweet (no number), then 4-8 numbered follow-up tweets (2. 3. etc.), end with a summary or CTA tweet.
Each tweet must be under 280 characters. Use line breaks between tweets.
Make it engaging, specific, and shareable. Return only the thread — no commentary, no preamble.`,
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
