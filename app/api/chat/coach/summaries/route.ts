import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { chatSummariesTable } from "@/db/schema/chat-summaries-schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

const SUMMARY_PROMPT = `Summarise this conversation in 1-2 short sentences. Capture the main topic and any outcome or next step. Output only the summary, no prefix or label.`;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({ id: chatSummariesTable.id, summary: chatSummariesTable.summary, createdAt: chatSummariesTable.createdAt })
      .from(chatSummariesTable)
      .where(eq(chatSummariesTable.userId, userId))
      .orderBy(desc(chatSummariesTable.createdAt))
      .limit(5);

    return NextResponse.json({ summaries: rows.map((r) => r.summary) });
  } catch (err) {
    console.error("[chat/coach/summaries] GET", err);
    return NextResponse.json({ error: "Failed to load summaries" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const { messages } = body as { messages?: { role: string; content: string }[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
    }

    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${(m.content || "").slice(0, 500)}`)
      .join("\n");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: transcript },
      ],
      max_tokens: 150,
    });

    const summary = completion.choices?.[0]?.message?.content?.trim() || "Conversation with coach.";
    await db.insert(chatSummariesTable).values({ userId, summary });

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[chat/coach/summaries] POST", err);
    return NextResponse.json({ error: "Failed to save summary" }, { status: 500 });
  }
}
