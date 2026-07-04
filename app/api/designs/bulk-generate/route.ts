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

type Platform = "instagram" | "tiktok-link" | "tiktok-nolink";
type CtaType = "automatic" | "link-in-bio" | "comment-keyword" | "visit-store" | "follow-for-more" | "custom";

function buildTopicPrompt(
  topic: string,
  count: number,
  styleDesc: string,
  niche?: string,
  tone?: string
): string {
  const narrativeHint =
    count >= 6
      ? `Arrange the posts as a carousel narrative arc:
- Post 1: Hook — attention-grabbing, creates curiosity or identifies a relatable problem
- Post 2: Problem — deepen the problem the audience faces
- Post 3: Why It Matters — explain why solving this problem is critical
- Posts 4 to ${Math.max(4, count - 2)}: Solutions & Insights — one actionable tip per post (vary the angle each time)
- Post ${count - 1}: Key Takeaway — the single most important thing to remember
- Post ${count}: Summary — recap and reinforce the whole carousel's value`
      : "Make each post a standalone valuable insight.";

  return `You are a viral social media content strategist specialising in short-form carousel content.

Generate exactly ${count} unique social media posts for the topic: "${topic}"
Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Inspirational"}${niche ? `\nTarget audience: ${niche}` : ""}

${narrativeHint}

Return a JSON object with a "posts" array. Each element must have EXACTLY these fields:
- hook: A scroll-stopping opening line (5–12 words, ALL CAPS, no hashtags). Use a specific number, relatable situation, or surprising truth. NEVER generic phrases like "TAKE CONTROL" or "UNLOCK YOUR POTENTIAL"
- mainText: The core value — a tip, insight, or truth (30–60 words, 2–3 short sentences, no bullet points)
- cta: Slide-level nudge (3–8 words, e.g. "Swipe to see →" or "Save this one ↓")
- bgTheme: One of exactly: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"

Rules:
- Every post must be completely unique — different angle, different hook style
- No filler phrases like "In today's world" or "Did you know"
- Each post must provide standalone value
- Keep hooks under 12 words and highly specific`;
}

function buildProductsPrompt(
  products: ProductInput[],
  count: number,
  styleDesc: string,
  tone?: string
): string {
  const productList = products
    .map(
      (p, i) =>
        `${i + 1}. "${p.title}" (${p.format}${p.niche ? ` · ${p.niche}` : ""}${p.description ? ` · ${p.description.slice(0, 120)}` : ""})`
    )
    .join("\n");

  const perProduct = Math.ceil(count / products.length);

  return `You are a viral social media content strategist specialising in digital product promotion.

Generate exactly ${count} social media posts promoting these digital products:
${productList}

Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Promotional"}

Spread the posts evenly across all products (roughly ${perProduct} posts per product).
Each post must promote the specific product and drive sales/interest.

Return a JSON object with a "posts" array. Each element must have EXACTLY these fields:
- hook: A scroll-stopping opening line (5–12 words, ALL CAPS, no hashtags). Use a specific number, relatable situation, or surprising truth. E.g. "I WAS £200 OVERDRAWN EVERY MONTH UNTIL THIS". NEVER generic phrases like "TAKE CONTROL" or "UNLOCK YOUR POTENTIAL"
- mainText: Sell the product — highlight the transformation, outcome, or key benefit (30–60 words, 2–3 sentences, no bullet points, no hashtags). Write naturally like a real person. NEVER mention the product name inside mainText.
- cta: Slide nudge (3–8 words, e.g. "Swipe to see →" or "Keep reading ↓")
- bgTheme: One of exactly: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"
- productTitle: The exact product title this post is for (from the list above)

Rules:
- Focus on outcomes and transformations, not features
- NEVER write the product name inside mainText
- Write mainText as if a real creator is speaking — conversational, specific, human
- Vary the angle for each post (problem-agitate-solve, social proof, curiosity, aspiration, urgency)
- No filler phrases like "Imagine a life where" or "Say goodbye to"
- Hooks must be scroll-stopping and specific`;
}

function resolveCtaAction(
  platform: Platform,
  ctaType: CtaType,
  ctaKeyword: string,
  ctaCustom: string
): string {
  if (ctaType === "custom" && ctaCustom) return `The CTA action (use this verbatim or a very close variation): "${ctaCustom}"`;
  if (ctaType === "follow-for-more") return `CTA action: Ask people to follow for more tips on this topic. E.g. "Follow so you never miss a post like this" or "Hit follow for more."`;
  if (ctaType === "visit-store") return `CTA action: Direct people to visit the store in bio. E.g. "Shop the link in bio 🛍️" or "Visit our store — link in bio".`;
  if (ctaType === "comment-keyword") {
    const kw = ctaKeyword || "GUIDE";
    return `CTA action: Ask people to comment the keyword "${kw}" to receive the link/resource. E.g. "Comment '${kw}' below and I'll DM you the link instantly."`;
  }
  // automatic or link-in-bio
  if (platform === "tiktok-nolink") {
    const kw = ctaKeyword || "LINK";
    return `CTA action: This is TikTok without a link in bio. Ask people to comment a keyword to get the resource. E.g. "Comment '${kw}' below and I'll send you the link."`;
  }
  return `CTA action: Direct people to the link in bio. E.g. "Tap the link in bio ↗" or "Link in bio — grab yours now."`;
}

function buildCtaPrompt(
  topic: string,
  platform: Platform,
  ctaType: CtaType,
  ctaKeyword: string,
  ctaCustom: string,
  styleDesc: string,
  tone?: string
): string {
  const platformLabel = {
    instagram: "Instagram",
    "tiktok-link": "TikTok (with link in bio enabled)",
    "tiktok-nolink": "TikTok (no link in bio — comment-only strategy)",
  }[platform];

  const ctaAction = resolveCtaAction(platform, ctaType, ctaKeyword, ctaCustom);

  return `You are a social media CTA copywriter specialised in ${platformLabel}.

The carousel was about: "${topic}"
Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Inspirational"}

Generate ONE powerful closing CTA slide for this carousel.
${ctaAction}

Return a JSON object with EXACTLY these fields:
- hook: A short punchy headline (4–8 words, ALL CAPS or Title Case). This is the main focal text on the slide. Make it feel like a natural conclusion. E.g. "READY TO GET STARTED?" or "Don't Let This Slide By"
- mainText: 1–2 supporting sentences (15–35 words) that reinforce the carousel's value and set up the call to action. Warm, human, direct.
- cta: The specific call to action text (5–15 words). This is what the viewer should DO — crystal-clear and platform-specific.
- bgTheme: One of: "dark", "gradient-warm", "gradient-cool" (pick one that creates urgency or energy)

Important:
- The hook should feel like a natural conclusion to the carousel
- The mainText bridges the carousel content to the action
- The cta must match the platform strategy described above`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await request
    .json()
    .catch(() => ({})) as {
    topic?: string;
    count?: number;
    style?: string;
    niche?: string;
    tone?: string;
    products?: ProductInput[];
    platform?: Platform;
    ctaType?: CtaType;
    ctaKeyword?: string;
    ctaCustom?: string;
  };

  const count = Math.min(Math.max(Number(body.count) || 10, 5), 30);
  const style = typeof body.style === "string" ? body.style : "minimal-luxury";
  const styleDesc = STYLE_DESCRIPTIONS[style] ?? "engaging and professional";
  const niche = typeof body.niche === "string" ? body.niche.trim() : undefined;
  const tone = typeof body.tone === "string" ? body.tone : undefined;
  const products =
    Array.isArray(body.products) && body.products.length > 0 ? body.products : null;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const platform: Platform = (body.platform as Platform) ?? "instagram";
  const ctaType: CtaType = (body.ctaType as CtaType) ?? "automatic";
  const ctaKeyword = typeof body.ctaKeyword === "string" ? body.ctaKeyword.trim() : "";
  const ctaCustom = typeof body.ctaCustom === "string" ? body.ctaCustom.trim() : "";

  if (!products && !topic)
    return NextResponse.json({ error: "topic or products required" }, { status: 400 });

  const contentPrompt = products
    ? buildProductsPrompt(products, count, styleDesc, tone)
    : buildTopicPrompt(topic, count, styleDesc, niche, tone);

  const topicForCta = products ? products.map((p) => p.title).join(", ") : topic;
  const ctaPrompt = buildCtaPrompt(
    topicForCta,
    platform,
    ctaType,
    ctaKeyword,
    ctaCustom,
    styleDesc,
    tone
  );

  // Fire both AI calls in parallel
  const [contentRes, ctaRes] = await Promise.all([
    fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: contentPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_tokens: 6000,
      }),
    }),
    fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: ctaPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 600,
      }),
    }),
  ]);

  if (!contentRes.ok) {
    const err = await contentRes.text();
    return NextResponse.json(
      { error: "AI request failed", details: err.slice(0, 200) },
      { status: 502 }
    );
  }

  const contentData = (await contentRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const contentText = contentData.choices?.[0]?.message?.content;
  if (!contentText)
    return NextResponse.json({ error: "No AI response" }, { status: 502 });

  let posts: unknown[] = [];
  try {
    const parsed = JSON.parse(contentText) as { posts?: unknown[] };
    posts = Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // Parse CTA slide — fail gracefully if it errors
  let ctaPost: Record<string, unknown> | null = null;
  if (ctaRes.ok) {
    try {
      const ctaData = (await ctaRes.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const ctaText = ctaData.choices?.[0]?.message?.content;
      if (ctaText) {
        ctaPost = JSON.parse(ctaText) as Record<string, unknown>;
        ctaPost.isCta = true;
      }
    } catch {
      // CTA generation failed — carousel is still usable without it
    }
  }

  const allPosts = ctaPost ? [...posts, ctaPost] : posts;
  return NextResponse.json({ posts: allPosts });
}
