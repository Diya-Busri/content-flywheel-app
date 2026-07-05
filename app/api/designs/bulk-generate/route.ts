import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

// ── Style descriptions ─────────────────────────────────────────────────────────

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "minimal-luxury": "elegant, premium, aspirational — short punchy hooks, clean high-value insights",
  "dark-aesthetic": "bold, edgy, raw — intense hooks, unfiltered truths, strong attitude",
  "wellness": "calm, nurturing, empowering — gentle encouragement, self-care and mindfulness",
  "clean-productivity": "clear, actionable, structured — numbered tips, quick wins, focus on results",
  "faceless-creator": "mysterious, relatable, scroll-stopping — faceless business and passive income vibes",
  "modern-business": "professional, confident, authoritative — business insights, metrics, results-focused",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductInput = { title: string; format: string; niche?: string; description?: string };
type CtaType = "automatic" | "link-in-bio" | "comment-keyword" | "visit-store" | "follow-for-more" | "custom";
type PlatformCfg = { ctaType: CtaType; ctaKeyword: string; ctaCustom: string };

// ── Per-platform details ───────────────────────────────────────────────────────

const PLATFORM_DETAILS: Record<string, {
  label: string;
  hasLink: boolean;
  captionStyle: string;
  hashtagCount: string;
  ctaExample: string;
}> = {
  instagram: {
    label: "Instagram",
    hasLink: true,
    captionStyle: "1–3 short punchy sentences (max 150 chars). Hook first, then the payoff. Emojis OK but not overdone.",
    hashtagCount: "20–25 hashtags mixing broad, mid-tier, and niche",
    ctaExample: "Tap the link in bio to grab yours 🔗",
  },
  "tiktok-link": {
    label: "TikTok (Link in Bio)",
    hasLink: true,
    captionStyle: "Ultra-short, conversational, 1–2 sentences max. TikTok slang OK. No formal language.",
    hashtagCount: "5–8 trending hashtags, max 3 niche ones",
    ctaExample: "Link in bio 👆 go check it out rn",
  },
  "tiktok-comment": {
    label: "TikTok (Comment Keyword)",
    hasLink: false,
    captionStyle: "Ultra-short caption with strong comment bait. Must ask viewers to comment a keyword to get the resource.",
    hashtagCount: "5–8 trending hashtags",
    ctaExample: "Comment 'GUIDE' below and I'll DM you the link instantly 💬",
  },
  linkedin: {
    label: "LinkedIn",
    hasLink: true,
    captionStyle: "Professional and value-first. 2–3 sentences, no fluff. Opens with an insight or stat. No casual slang.",
    hashtagCount: "3–5 professional industry hashtags",
    ctaExample: "Full breakdown in the link below — worth 5 minutes of your time.",
  },
  pinterest: {
    label: "Pinterest",
    hasLink: true,
    captionStyle: "Descriptive and SEO-rich. 2–3 sentences describing what the pin delivers. Keyword-rich, benefit-focused.",
    hashtagCount: "10–15 SEO-focused keywords as hashtags",
    ctaExample: "Save this pin + tap the link to get the full resource 📌",
  },
  facebook: {
    label: "Facebook",
    hasLink: true,
    captionStyle: "Warm and community-driven. 2–3 sentences. Can ask a question to spark comments. Conversational tone.",
    hashtagCount: "3–5 hashtags maximum",
    ctaExample: "Drop a comment below or visit the link in bio to learn more 👇",
  },
  twitter: {
    label: "X (Twitter)",
    hasLink: true,
    captionStyle: "Sharp and opinionated. Max 240 chars including spaces. Bold statement or contrarian take. Link at end.",
    hashtagCount: "2–3 hashtags inline, not at the end",
    ctaExample: "Full thread in the link ↓",
  },
  threads: {
    label: "Threads",
    hasLink: true,
    captionStyle: "Conversational and reply-bait. 1–2 punchy sentences. End with a question or opinion to drive replies.",
    hashtagCount: "3–5 hashtags or none",
    ctaExample: "What do you think? Drop your take below 👇 (link in bio for the full thing)",
  },
};

// ── Content prompt builders ────────────────────────────────────────────────────

function buildTopicPrompt(topic: string, count: number, styleDesc: string, niche?: string, tone?: string): string {
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

function buildProductsPrompt(products: ProductInput[], count: number, styleDesc: string, tone?: string): string {
  const productList = products
    .map((p, i) => `${i + 1}. "${p.title}" (${p.format}${p.niche ? ` · ${p.niche}` : ""}${p.description ? ` · ${p.description.slice(0, 120)}` : ""})`)
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
- hook: A scroll-stopping opening line (5–12 words, ALL CAPS, no hashtags). E.g. "I WAS £200 OVERDRAWN EVERY MONTH UNTIL THIS". NEVER generic phrases.
- mainText: Sell the product — highlight the transformation, outcome, or key benefit (30–60 words, 2–3 sentences, no bullet points, no hashtags). Write naturally. NEVER mention the product name inside mainText.
- cta: Slide nudge (3–8 words, e.g. "Swipe to see →" or "Keep reading ↓")
- bgTheme: One of exactly: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"
- productTitle: The exact product title this post is for (from the list above)

Rules:
- Focus on outcomes and transformations, not features
- NEVER write the product name inside mainText
- Write mainText as if a real creator is speaking — conversational, specific, human
- Vary the angle for each post (problem-agitate-solve, social proof, curiosity, aspiration, urgency)
- No filler phrases like "Imagine a life where" or "Say goodbye to"`;
}

// ── CTA prompt builders ────────────────────────────────────────────────────────

function buildAiPlatformPrompt(
  platformId: string,
  topic: string,
  styleDesc: string,
  tone?: string
): string {
  const pd = PLATFORM_DETAILS[platformId] ?? PLATFORM_DETAILS.instagram;
  return `You are a social media CTA copywriter specialised in ${pd.label}.

The carousel was about: "${topic}"
Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Inspirational"}

Generate:
1. ONE powerful closing CTA slide for this carousel
2. A platform-optimised caption
3. Platform-appropriate hashtags

Caption style: ${pd.captionStyle}
Hashtags: ${pd.hashtagCount}
CTA example: ${pd.ctaExample}

Return a JSON object with EXACTLY these fields:
- ctaSlide: object with fields:
  - hook: Short punchy headline (4–8 words, ALL CAPS or Title Case). Natural conclusion. E.g. "READY TO GET STARTED?"
  - mainText: 1–2 supporting sentences (15–35 words) bridging carousel to action. Warm, human, direct.
  - cta: The specific call to action text (5–15 words). Crystal-clear and platform-specific for ${pd.label}.
  - bgTheme: One of: "dark", "gradient-warm", "gradient-cool"
- caption: string — platform-optimised caption following the style above
- hashtags: string[] — array of hashtag strings (with # prefix) following count guidance above

Important:
- ctaSlide.hook should feel like a natural conclusion to the carousel
- ctaSlide.cta must match ${pd.label} best practices (example: ${pd.ctaExample})
- caption must be optimised for ${pd.label} engagement and algorithm
- Do NOT include hashtags inside the caption — they go in the hashtags array only`;
}

function buildManualPlatformPrompt(
  platformId: string,
  topic: string,
  styleDesc: string,
  cfg: PlatformCfg,
  tone?: string
): string {
  const pd = PLATFORM_DETAILS[platformId] ?? PLATFORM_DETAILS.instagram;

  let ctaAction = "";
  if (cfg.ctaType === "custom" && cfg.ctaCustom) {
    ctaAction = `The CTA action (use this verbatim or a very close variation): "${cfg.ctaCustom}"`;
  } else if (cfg.ctaType === "follow-for-more") {
    ctaAction = `CTA action: Ask people to follow for more tips. E.g. "Follow so you never miss a post like this"`;
  } else if (cfg.ctaType === "visit-store") {
    ctaAction = `CTA action: Direct people to visit the store in bio. E.g. "Shop the link in bio 🛍️"`;
  } else if (cfg.ctaType === "comment-keyword") {
    const kw = cfg.ctaKeyword || "GUIDE";
    ctaAction = `CTA action: Ask people to comment the keyword "${kw}" to receive the link. E.g. "Comment '${kw}' below and I'll DM you the link instantly."`;
  } else if (!pd.hasLink) {
    const kw = cfg.ctaKeyword || "LINK";
    ctaAction = `CTA action: No link in bio. Ask people to comment a keyword. E.g. "Comment '${kw}' below and I'll send you the link."`;
  } else {
    ctaAction = `CTA action: Direct people to the link in bio. E.g. "${pd.ctaExample}"`;
  }

  return `You are a social media CTA copywriter specialised in ${pd.label}.

The carousel was about: "${topic}"
Style/Aesthetic: ${styleDesc}
Tone: ${tone ?? "Inspirational"}

Generate:
1. ONE powerful closing CTA slide
2. A platform-optimised caption
3. Platform-appropriate hashtags

${ctaAction}
Caption style: ${pd.captionStyle}
Hashtags: ${pd.hashtagCount}

Return a JSON object with EXACTLY these fields:
- ctaSlide: object with fields:
  - hook: Short punchy headline (4–8 words, ALL CAPS or Title Case). Natural conclusion.
  - mainText: 1–2 supporting sentences (15–35 words). Warm, human, direct.
  - cta: The specific call to action text (5–15 words). Crystal-clear for ${pd.label}.
  - bgTheme: One of: "dark", "gradient-warm", "gradient-cool"
- caption: string — platform-optimised caption
- hashtags: string[] — array of hashtag strings (with # prefix)`;
}

// ── POST handler ───────────────────────────────────────────────────────────────

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
    // New multi-platform fields
    platforms?: string[];
    ctaStrategy?: "ai" | "manual";
    perPlatformCta?: Record<string, PlatformCfg>;
  };

  const count = Math.min(Math.max(Number(body.count) || 10, 5), 30);
  const style = typeof body.style === "string" ? body.style : "minimal-luxury";
  const styleDesc = STYLE_DESCRIPTIONS[style] ?? "engaging and professional";
  const niche = typeof body.niche === "string" ? body.niche.trim() : undefined;
  const tone = typeof body.tone === "string" ? body.tone : undefined;
  const products = Array.isArray(body.products) && body.products.length > 0 ? body.products : null;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const platforms = Array.isArray(body.platforms) && body.platforms.length > 0 ? body.platforms : ["instagram"];
  const ctaStrategy = body.ctaStrategy === "manual" ? "manual" : "ai";
  const perPlatformCta: Record<string, PlatformCfg> = body.perPlatformCta ?? {};

  if (!products && !topic)
    return NextResponse.json({ error: "topic or products required" }, { status: 400 });

  const topicForCta = products ? products.map((p) => p.title).join(", ") : topic;
  const contentPrompt = products
    ? buildProductsPrompt(products, count, styleDesc, tone)
    : buildTopicPrompt(topic, count, styleDesc, niche, tone);

  // Build per-platform CTA prompts
  const platformPrompts = platforms.map((pid) => {
    if (ctaStrategy === "manual" && perPlatformCta[pid]) {
      return buildManualPlatformPrompt(pid, topicForCta, styleDesc, perPlatformCta[pid], tone);
    }
    return buildAiPlatformPrompt(pid, topicForCta, styleDesc, tone);
  });

  // Fire all AI calls in parallel: 1 content + N platform CTA calls
  const allPromises = [
    fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: contentPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_tokens: 6000,
      }),
    }),
    ...platformPrompts.map((prompt) =>
      fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 900,
        }),
      })
    ),
  ];

  const [contentRes, ...platformReses] = await Promise.all(allPromises);

  if (!contentRes.ok) {
    const err = await contentRes.text();
    return NextResponse.json({ error: "AI request failed", details: err.slice(0, 200) }, { status: 502 });
  }

  const contentData = (await contentRes.json()) as { choices?: { message?: { content?: string } }[] };
  const contentText = contentData.choices?.[0]?.message?.content;
  if (!contentText) return NextResponse.json({ error: "No AI response" }, { status: 502 });

  let posts: unknown[] = [];
  try {
    const parsed = JSON.parse(contentText) as { posts?: unknown[] };
    posts = Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // Parse per-platform outputs — fail gracefully per platform
  const platformOutputs: Array<{
    platformId: string;
    caption: string;
    hashtags: string[];
    ctaSlide: Record<string, unknown> | null;
  }> = [];

  for (let i = 0; i < platforms.length; i++) {
    const pid = platforms[i];
    const res = platformReses[i];
    let caption = "";
    let hashtags: string[] = [];
    let ctaSlide: Record<string, unknown> | null = null;

    if (res && res.ok) {
      try {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as {
            ctaSlide?: Record<string, unknown>;
            caption?: string;
            hashtags?: string[];
          };
          ctaSlide = parsed.ctaSlide ? { ...parsed.ctaSlide, isCta: true } : null;
          caption = typeof parsed.caption === "string" ? parsed.caption : "";
          hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h): h is string => typeof h === "string") : [];
        }
      } catch {
        // Platform CTA failed — include platform with empty values
      }
    }

    platformOutputs.push({ platformId: pid, caption, hashtags, ctaSlide });
  }

  return NextResponse.json({ posts, platformOutputs });
}
