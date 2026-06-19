import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "minimal-luxury": "elegant, premium, aspirational — short punchy hooks, clean high-value insights",
  "dark-aesthetic": "bold, edgy, raw — intense hooks, unfiltered truths, strong attitude",
  "wellness": "calm, nurturing, empowering — gentle encouragement, self-care and mindfulness",
  "clean-productivity": "clear, actionable, structured — numbered tips, quick wins, focus on results",
  "faceless-creator": "mysterious, relatable, scroll-stopping — faceless business and passive income vibes",
  "modern-business": "professional, confident, authoritative — business insights, metrics, results-focused",
};

type ProductInput = {
  title: string;
  format: string;
  niche?: string;
  description?: string;
};

function buildTopicPrompt(topic: string, count: number, styleDesc: string, niche?: string, tone?: string): string {
  return `You are a viral social media content strategist specialising in short-form content.

Generate exactly ${count} unique social media posts for the topic: "${topic}"
Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Inspirational"}${niche ? `\nTarget audience: ${niche}` : ""}

Return a JSON object with a "posts" array. Each element must have EXACTLY these fields:
- hook: A scroll-stopping opening line (5–12 words, written in ALL CAPS, punchy, no hashtags)
- mainText: The core value — a tip, insight, or truth (30–60 words, 2–3 short sentences, no bullet points)
- cta: Call to action (5–10 words, starts with an action verb, no hashtags)
- bgTheme: One of exactly: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"

Rules:
- Every post must be completely unique — different angle, different hook style
- No filler phrases like "In today's world" or "Did you know"
- Each post must provide standalone value
- Keep hooks under 12 words and highly specific`;
}

function buildProductsPrompt(products: ProductInput[], count: number, styleDesc: string, tone?: string): string {
  const productList = products.map((p, i) =>
    `${i + 1}. "${p.title}" (${p.format}${p.niche ? ` · ${p.niche}` : ""}${p.description ? ` · ${p.description.slice(0, 120)}` : ""})`
  ).join("\n");

  const perProduct = Math.ceil(count / products.length);

  return `You are a viral social media content strategist specialising in digital product promotion.

Generate exactly ${count} social media posts promoting these digital products:
${productList}

Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Promotional"}

Spread the posts evenly across all products (roughly ${perProduct} posts per product).
Each post must be a promotional social media post designed to drive sales/interest in the specific product.

Return a JSON object with a "posts" array. Each element must have EXACTLY these fields:
- hook: A scroll-stopping opening line (5–12 words, ALL CAPS, product-benefit focused, no hashtags)
- mainText: Sell the product — highlight the transformation, outcome, or key benefit (30–60 words, 2–3 sentences, no bullet points, no hashtags). Write naturally like a real person, NOT like an AI. NEVER mention the product name or put it in quotes inside the body text — let the hook and CTA do that work.
- cta: Sales call to action (5–10 words, starts with verb — e.g. "Grab your copy today", "Get instant access now")
- bgTheme: One of exactly: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"
- productTitle: The exact product title this post is for (from the list above)

Rules:
- Focus on outcomes and transformations, not features
- NEVER write the product name inside mainText (e.g. never write "Our 'X' guide" or "The 'X' ebook")
- Write mainText as if a real creator is speaking to their audience — conversational, specific, human
- Vary the angle for each post (problem-agitate-solve, social proof, curiosity, aspiration, urgency)
- No filler phrases like "Imagine a life where" or "Say goodbye to"
- Hooks must be scroll-stopping and specific`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    topic?: string;
    count?: number;
    style?: string;
    niche?: string;
    tone?: string;
    products?: ProductInput[];
  };

  const count = Math.min(Math.max(Number(body.count) || 10, 5), 30);
  const style = typeof body.style === "string" ? body.style : "minimal-luxury";
  const styleDesc = STYLE_DESCRIPTIONS[style] ?? "engaging and professional";
  const niche = typeof body.niche === "string" ? body.niche.trim() : undefined;
  const tone = typeof body.tone === "string" ? body.tone : undefined;
  const products = Array.isArray(body.products) && body.products.length > 0 ? body.products : null;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";

  if (!products && !topic) return NextResponse.json({ error: "topic or products required" }, { status: 400 });

  const prompt = products
    ? buildProductsPrompt(products, count, styleDesc, tone)
    : buildTopicPrompt(topic, count, styleDesc, niche, tone);

  const response = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: "AI request failed", details: err.slice(0, 200) }, { status: 502 });
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return NextResponse.json({ error: "No AI response" }, { status: 502 });

  let posts: unknown[] = [];
  try {
    const parsed = JSON.parse(content) as { posts?: unknown[] };
    posts = Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  return NextResponse.json({ posts });
}
