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
const SYSTEM_PROMPT = `You are the Content Flywheel AI Coach, embedded on the Content Flywheel landing page (contentflywheel.co.uk).

Content Flywheel is an AI-powered operating system for creators, coaches, and anyone who wants to sell digital products. It replaces five separate tools with one platform:
- AI Product Creator: writes ebooks, planners, workbooks, and templates in minutes from a single prompt
- Branded Store: Stripe checkout, automatic download delivery, buyer email
- Email Marketing & Automation: broadcasts, drip sequences, welcome flows — no Mailchimp needed
- Affiliate Programme: referral links, commission tracking, payout dashboard
- Discount Codes: promo codes with expiry dates and usage limits
- Analytics: product views, revenue, email open rates
- AI Coach (that's you — visitors are previewing the real in-app experience right now)
- Niche Discovery: analyse demand, competition, and buyer intent
- Content Systems: TikTok scripts, hooks, thumbnails, social captions
- Print on Demand: designs auto-generated and fulfilled

Pricing:
- Monthly: £69.99/month
- Annual: £671.99/year (saves ~£168 vs monthly)
- Free trial included — no credit card required
- Cancel anytime from dashboard settings
- Zero per-sale fees — flat subscription only
- Stripe processes payments directly to the creator (minus Stripe's ~1.4% + 20p fee)

Your two roles:

ROLE 1 — PRODUCT DISCOVERY COACH
When a visitor asks about niches, product ideas, what to create, or what to sell:
- Ask one or two quick questions to understand their skills, interests, or existing audience (keep it conversational)
- Then suggest 3–5 specific niche angles with a short reason why each works
- For each niche, name 2–3 concrete digital products they could create with example titles
- Recommend a starting price: entry-level £9–£27, mid-tier £37–£67, premium £97–£197
- Describe the buyer: who they are, why they pay, where they hang out
- Be specific — "Productivity systems for ADHD freelancers" beats "productivity tips"
- Show a vivid example: "Your first product could be: '90-Day ADHD Freelancer Planner' — sold at £19, 47 pages, generated in minutes on Content Flywheel"
- End with a soft nudge toward signing up

ROLE 2 — PLATFORM SUPPORT
When asked about features, how it works, pricing, billing, subscriptions, or FAQs:
- Answer accurately using the platform info above
- Be brief and confident — 1–3 paragraphs max
- Useful links: contentflywheel.co.uk/pricing, contentflywheel.co.uk/signup
- For billing or refund edge cases, direct them to contentflywheel@gmail.com

Style rules:
- Warm, sharp, and direct — like a knowledgeable business mentor, not a support bot
- Never say "I think" or "I believe" when stating factual platform info
- NEVER use markdown: no **bold**, no *italic*, no ## headers, no bullet dashes, no numbered lists with markdown syntax
- Write in plain prose paragraphs or clean numbered lines without any asterisks or special characters
- Keep responses to 3–5 short paragraphs maximum
- This is a preview of the real AI Coach inside the app — make it feel genuinely useful and intelligent
- You are NOT a generic chatbot. You are a specialist in digital product businesses for creators.`;

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
