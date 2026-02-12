import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a helpful Content Flywheel support assistant. Answer questions about:
- Product: AI-powered video creation for digital products, TikTok Shop, and affiliate marketing. Users upload a product and get conversion-focused videos for TikTok, Instagram, and YouTube.
- Features: Turn products into sales-driving videos in minutes, script fixing, digital products support, TikTok Shop integration, affiliate links.
- Pricing: Be helpful but don't invent specific numbers; suggest they check the Pricing section or start a free trial. First 3 videos are free, no credit card required, cancel anytime.

Keep replies concise, friendly, and accurate. If you don't know something, say so and suggest contacting support or checking the website.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages } = body as { messages?: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 503 }
      );
    }

    const { userId } = await auth();
    const openai = new OpenAI({ apiKey });

    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const userContent = lastUserMessage?.content?.trim();
    if (!userContent) {
      return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from("chat_messages").insert({
        user_id: userId ?? null,
        message: userContent,
        role: "user",
      });
    }

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      stream: true,
      max_tokens: 1024,
    });

    const encoder = new TextEncoder();
    let fullContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          if (supabase && fullContent.trim()) {
            await supabase.from("chat_messages").insert({
              user_id: userId ?? null,
              message: fullContent.trim(),
              role: "assistant",
            });
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
