export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const OPENAI_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are the support assistant for Content Flywheel (contentflywheel.co.uk), a platform that helps creators build, package, and market digital products with AI.

**What Content Flywheel does:**
- Ebook, planner, and workbook generation from ideas
- AI voiceovers and video scripts
- Multi-platform marketing content for TikTok, Instagram, and YouTube
- Digital product creation and TikTok Shop video generation
- Script compliance checking for platform guidelines

**Pricing (accurate):**
- £69.99/month or £671.99/year (annual saves money)
- First 3 videos free, no credit card required; cancel anytime

**Your behaviour:**
- Be concise, friendly, and accurate. Answer in 1–3 short paragraphs unless the user needs more.
- When relevant, include direct links to the app:
  - Dashboard: https://contentflywheel.co.uk/dashboard
  - Digital products: https://contentflywheel.co.uk/dashboard/digital-products
  - TikTok Shop: https://contentflywheel.co.uk/dashboard/tiktok-shop
  - Script checker: https://contentflywheel.co.uk/dashboard/script-checker
  - Pricing: https://contentflywheel.co.uk/pricing
  - Refund policy: https://contentflywheel.co.uk/refund-policy
  - Terms: https://contentflywheel.co.uk/terms
  - Privacy: https://contentflywheel.co.uk/privacy
- If the user says they found a bug or describes a problem, acknowledge it and say we've logged it (we log it on our side). Suggest they can also email contentflywheel@gmail.com for urgent issues.
- If you don't know something, say so and suggest contacting support at contentflywheel@gmail.com or checking the site.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      messages,
      email,
      isBugDescription,
    } = body as {
      messages?: ChatMessage[];
      email?: string;
      isBugDescription?: boolean;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const { userId } = await auth();
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId ?? null);
    if (rl) return rl;
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const userContent = lastUserMessage?.content?.trim() ?? "";

    // Logged-out lead capture: require email after first message
    if (!userId) {
      const leadEmail = typeof email === "string" ? email.trim() : "";
      if (!leadEmail) {
        return NextResponse.json({ requireEmail: true });
      }
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from("chat_leads").insert({ email: leadEmail });
      }
    }

    // Bug report: save to feedback then continue
    if (isBugDescription && userContent) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from("feedback").insert({
          user_id: userId ?? null,
          type: "bug",
          rating: 0,
          feedback_text: userContent.slice(0, 2000),
        });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI support is not configured" },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: openaiMessages,
      stream: true,
      max_tokens: 1024,
    });

    const encoder = new TextEncoder();
    const supabase = getSupabaseAdmin();
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
              message: userContent || "(no message)",
              role: "user",
            });
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
