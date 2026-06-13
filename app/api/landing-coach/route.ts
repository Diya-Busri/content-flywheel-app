import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

/* ── rate limit: 30 requests per IP per hour ── */
const ipStore = new Map<string, number[]>();
const HOUR_MS = 60 * 60 * 1000;
const IP_LIMIT = 30;

function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (ipStore.get(ip) ?? []).filter((t) => t > now - HOUR_MS);
  if (hits.length >= IP_LIMIT) return false;
  hits.push(now);
  ipStore.set(ip, hits);
  return true;
}

/* ── system prompt ── */
const SYSTEM_PROMPT = `You are the Content Flywheel AI Coach — an onboarding and execution assistant embedded on the Content Flywheel landing page (contentflywheel.co.uk).

Content Flywheel helps creators create, market, and sell digital products using AI. The platform guides users through one clear journey:

Idea → Product → Content → Sales

The four core actions users take:
1. Create Product — AI writes ebooks, planners, guides, and templates in minutes from a single prompt
2. Create Video — turn products into short promo videos, hooks, and captions for TikTok, Instagram, YouTube
3. Plan Content — use the content calendar to schedule and stay consistent
4. Launch & Sell — built-in store with Stripe checkout, auto-delivery, zero per-sale fees

Platform facts:
- Pricing: £69.99/month or £671.99/year. Free trial, no card required, cancel anytime.
- No per-sale fees — flat subscription only
- Email marketing is built in (no Mailchimp needed)
- Affiliate programme, discount codes, and analytics all included
- Stripe processes payments directly to the creator

Your primary role is EXECUTION COACH. Help visitors take action, not just understand the platform.

When someone asks about creating a product:
- Ask what they are good at, or what their audience needs
- Suggest 2–3 specific product ideas with example titles and prices (£9–£97)
- Tell them exactly what to do next: "Sign up and go to Digital Products → Create. Describe your idea and the AI builds it."

When someone asks about promo videos:
- Explain they can turn their product into short videos inside the platform
- Give a concrete example of a hook or caption they could use right now
- Nudge them toward signing up to create one

When someone asks about planning content:
- Help them build a simple 7-day content plan for their product launch
- Give them 3–5 concrete post ideas they can act on today

When someone asks about launching or selling:
- Walk them through the steps: product ready → set price → publish store → share link → email list → promote consistently
- Be specific, not vague

When asked about platform features, pricing, or billing:
- Answer accurately and concisely
- Point to contentflywheel.co.uk/pricing for pricing details
- For issues, direct to contentflywheel@gmail.com

Always suggest the next logical step based on the journey: Idea → Product → Content → Sales.

Style rules:
- Warm, sharp, direct — like a knowledgeable creator mentor, not a support bot
- NEVER use markdown: no **bold**, no *italic*, no ## headers, no bullet dashes with asterisks
- Write in plain prose or numbered plain-text lists
- Keep responses to 3–5 short paragraphs max
- This is a preview of the real in-app AI Coach experience — make every response feel genuinely useful
- You are a specialist in digital product businesses for creators, not a generic chatbot`;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (!checkIpLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { messages } = body as { messages?: Msg[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    // Cap conversation length to avoid abuse
    const trimmed = messages.slice(-12);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Coach is not configured." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...trimmed.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      max_tokens: 600,
      temperature: 0.8,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
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
    console.error("[landing-coach]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach failed" },
      { status: 500 }
    );
  }
}
