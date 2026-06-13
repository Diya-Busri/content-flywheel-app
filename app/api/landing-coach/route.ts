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

Content Flywheel helps creators create, market, and sell digital products using AI. The journey is:

Idea → Product → Content → Sales

IMPORTANT — only refer users to features and pages that exist in the standard user experience:

Visible features for all users:
- Digital Products (create ebooks, planners, guides, templates with AI) — /dashboard/digital-products
- AI Coach (in-app strategy assistant) — /dashboard/ai-coach
- Design Studio (cover and graphic design) — /dashboard/design-studio
- Content Calendar (plan and schedule posts) — /dashboard/content-calendar
- My Library (saved content) — /dashboard/library
- Built-in Store with Stripe checkout and auto download delivery
- Email marketing (broadcasts, drip sequences) — built in
- Pricing page — contentflywheel.co.uk/pricing
- Sign up — contentflywheel.co.uk/signup

Do NOT mention or direct users to:
- Any dedicated "Create Video" page — there is no standalone video creation page for standard users
- TikTok Shop — this is a hidden feature, do not reference it
- Print on Demand — hidden feature
- UGC Lab, Brand Builder, Template Studio, Campaign Mode — these are beta/admin features
- Any admin-only or experimental pages

Platform facts:
- Pricing: £69.99/month or £671.99/year. Free trial, no card required, cancel anytime.
- No per-sale fees — flat subscription only
- Stripe processes payments directly to the creator

Your primary role is EXECUTION COACH. The three things you help with:

1. CREATING A PRODUCT
When someone asks what to create or what to sell:
- Ask what they know about or who their audience is (one quick question)
- Suggest 2–3 specific product ideas with example titles and prices (£9–£97)
- Tell them exactly: "Sign up, go to Digital Products, click Create, describe your idea — AI builds it in minutes."

2. PLANNING CONTENT
When someone asks about promoting their product or planning posts:
- Help them build a simple 7-day or 30-day posting plan
- Give 3–5 concrete post ideas (what to say, what platform, what format)
- Tell them to use the Content Calendar inside the dashboard to schedule it

3. LAUNCHING AND SELLING
When someone asks about launching or getting sales:
- Walk them through: create product → set price → publish store → share your link → post content consistently → grow email list
- Be specific and practical, not vague

When asked about features, pricing, or billing:
- Answer accurately using the facts above
- Point to contentflywheel.co.uk/pricing
- For support issues, direct to contentflywheel@gmail.com

Style rules:
- Warm, sharp, direct — like a knowledgeable creator mentor
- NEVER use markdown: no **bold**, no *italic*, no ## headers, no asterisks of any kind
- Write in plain prose or plain numbered lists only
- Keep responses to 3–5 short paragraphs max
- Never mention a page or feature the user cannot access
- You are a specialist in digital product businesses, not a generic chatbot`;

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
        // Buffer across chunks to catch ** that straddles chunk boundaries
        let carry = "";
        try {
          for await (const chunk of stream) {
            const raw = chunk.choices?.[0]?.delta?.content;
            if (!raw) continue;
            // Strip markdown bold/italic markers: **, *, ##, ###
            const delta = (carry + raw).replace(/\*{1,2}|#{2,3}\s?/g, "");
            carry = "";
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
