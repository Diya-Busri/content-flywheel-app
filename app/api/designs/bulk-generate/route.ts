import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type CarouselType =
  | "viral-tiktok" | "instagram" | "linkedin" | "storytelling"
  | "educational" | "mistakes" | "checklist" | "before-after"
  | "myth-vs-fact" | "case-study" | "sales" | "beginner-guide";

type QualityScore = {
  scrollStopper: number;
  curiosity: number;
  readability: number;
  shareability: number;
  conversion: number;
  overall: number;
  weakSlides: number[];
  suggestions: string[];
};

type SlideRow = {
  hook: string;
  mainText: string;
  cta: string;
  bgTheme: string;
  isCta?: boolean;
};

type ProductInput = { title: string; format: string; niche?: string; description?: string };
type CtaType = "automatic" | "link-in-bio" | "comment-keyword" | "visit-store" | "follow-for-more" | "custom";
type PlatformCfg = { ctaType: CtaType; ctaKeyword: string; ctaCustom: string };

// ── Carousel type frameworks ───────────────────────────────────────────────────

const FRAMEWORKS: Record<CarouselType, { name: string; structure: string; toneHint: string }> = {
  "viral-tiktok": {
    name: "Problem → Twist → Solution",
    structure: `Slide 1 (HOOK): Bold, shocking, or deeply relatable statement. Creates instant FOMO or curiosity.
Slide 2 (TWIST): Subvert expectations. The thing nobody talks about. "But here's what they don't tell you."
Slides 3–N (REVEALS): One punchy reveal per slide. Each slide must make them swipe for the next.
Last slide (CTA): Short. Conversational. Match TikTok energy.`,
    toneHint: "Raw, fast, meme energy. No corporate speak. Zero filler.",
  },
  "instagram": {
    name: "Hook → Value → Save",
    structure: `Slide 1 (HOOK): Aesthetic but attention-grabbing. The kind of thing people screenshot.
Slides 2–N (VALUE): One tip or insight per slide. Short sentences. Leave them wanting more.
Last slide (CTA): "Save this for later" energy. Encourage saves over follows.`,
    toneHint: "Aesthetic, aspirational, but grounded. Instagram creator voice.",
  },
  "linkedin": {
    name: "Insight → Story → Takeaway",
    structure: `Slide 1 (HOOK): Start with a counterintuitive insight or bold professional claim.
Slides 2–3 (STORY): Brief personal or client story that proves the hook.
Slides 4–N (INSIGHTS): One professional insight per slide. Data and specifics win.
Last slide (CTA): What they can do with this. Professional but human.`,
    toneHint: "Confident, professional, thought-leadership. No buzzword soup.",
  },
  "storytelling": {
    name: "Setup → Conflict → Resolution",
    structure: `Slide 1 (HOOK): Drop them in the middle of the story. Most compelling moment first.
Slide 2 (SETUP): Quick context — who, what, when.
Slides 3–N (CONFLICT): The problem/challenge escalating. Make them feel it.
Second to last (RESOLUTION): How it turned around.
Last slide (CTA): The lesson + invite them in.`,
    toneHint: "Cinematic, emotional, relatable. Short punchy sentences that build tension.",
  },
  "educational": {
    name: "Concept → Examples → Takeaway",
    structure: `Slide 1 (HOOK): The ONE thing this carousel teaches. Promise a clear outcome.
Slide 2 (CONCEPT): Explain the core idea in 1 sentence.
Slides 3–N (EXAMPLES): One example per slide. Real, specific, visual.
Last slide (CTA): Takeaway + what to do next.`,
    toneHint: "Clear, structured, authoritative. Teach one thing exceptionally well.",
  },
  "mistakes": {
    name: "Mistake → Why It Fails → Fix",
    structure: `Slide 1 (HOOK): Name the mistake bluntly. Creates FOMO and self-recognition.
Slide 2 (PROBLEM): Why this mistake keeps happening / why it's costing people.
Slides 3–N (FIXES): One fix per slide. Specific and immediately actionable.
Last slide (CTA): If you're making this mistake, here's what to do right now.`,
    toneHint: "Direct, slightly confrontational, empowering. Call it out, fix it.",
  },
  "checklist": {
    name: "Hook → Items → Summary",
    structure: `Slide 1 (HOOK): The power of having all of this in one place. Promise a list.
Slides 2–N (ITEMS): One checklist item per slide. Short label + one-line explanation.
Last slide (CTA): Save the checklist. This is the one people bookmark.`,
    toneHint: "Practical, list-friendly, instantly saveable. People love checking boxes.",
  },
  "before-after": {
    name: "Before → The Shift → After",
    structure: `Slide 1 (HOOK): The 'before' state — something people deeply identify with.
Slides 2–3 (BEFORE): Make the before feel vivid and real.
Slide 4 (SHIFT): The single thing that changed everything.
Slides 5–N (AFTER): The after state — specific, believable outcomes.
Last slide (CTA): How they can get the 'after' state too.`,
    toneHint: "Transformation energy. Specificity makes transformations believable.",
  },
  "myth-vs-fact": {
    name: "Myth → Reality → Impact",
    structure: `Slide 1 (HOOK): Lead with the most common myth. People need to know if they believe it.
Slides 2–N (PAIRS): Alternate myth/fact pairs. One myth per slide, one fact per slide.
Last slide (CTA): Now that you know the truth, here's what to do.`,
    toneHint: "Slightly controversial. Challenge conventional wisdom but stay factual.",
  },
  "case-study": {
    name: "Context → Challenge → Results",
    structure: `Slide 1 (HOOK): Lead with the result — the impressive outcome. Then explain how.
Slide 2 (CONTEXT): Who/what/when in 1-2 sentences.
Slides 3–4 (CHALLENGE): The specific problem they faced.
Slides 5–N (SOLUTION): What changed, step by step.
Last slide (RESULTS + CTA): The outcome in numbers + how they can replicate it.`,
    toneHint: "Evidence-based, credibility-building. Numbers and specifics are essential.",
  },
  "sales": {
    name: "Pain → Promise → Proof → Offer",
    structure: `Slide 1 (HOOK/PAIN): Name the exact pain. Make them feel seen.
Slides 2–3 (PROMISE): What life looks like after the solution.
Slides 4–N (PROOF): Social proof, results, transformation. Specific numbers.
Second to last (OFFER): What you're offering and why now.
Last slide (CTA): The specific action to take right now.`,
    toneHint: "Empathetic but urgent. Speak to the pain, sell the solution, not the product.",
  },
  "beginner-guide": {
    name: "Hook → Steps → Results",
    structure: `Slide 1 (HOOK): Why this guide exists — the problem it solves for beginners.
Slides 2–N (STEPS): One step per slide. Clear label + one-line action.
Second to last (RESULTS): What following these steps leads to.
Last slide (CTA): Where to start + save this as a reference.`,
    toneHint: "Accessible, encouraging, non-intimidating. Never make them feel stupid.",
  },
};

// ── Copy rules (injected into every carousel prompt) ─────────────────────────

const COPY_RULES = `
CRITICAL COPY RULES — These are absolute requirements. No exceptions:

1. hook: 3–8 words, ALL CAPS. One short line. No commas.
2. mainText: Maximum 2 SHORT sentences. Ideally 5–15 words total. Fragments are fine.
3. NEVER write paragraphs. NEVER write more than 2 sentences.
4. Build curiosity — each slide should make them want slide N+1.
5. Prefer fragments over complete sentences when it adds punch.
6. Use specific numbers, names, and facts over vague claims.
7. Every slide = ONE idea. If you have two ideas, split the slide.

BAD examples (too verbose — reject these):
- "Budgeting can be difficult for university students because they often struggle to manage their monthly expenses."
- "When building a successful online business, there are many important factors that you should consider carefully."

GOOD examples (punchy — use these as a style guide):
hook: "YOU'RE LOSING MONEY" / mainText: "Every. Single. Week.\nAnd you don't even know it."
hook: "NOBODY TEACHES THIS" / mainText: "3 years. 0 results.\nThen I changed this one thing."
hook: "STOP DOING THIS" / mainText: "It's killing your growth.\nHere's why."
hook: "THE SHORTCUT NOBODY USES" / mainText: "I doubled revenue in 30 days.\nThis is how."
`;

// ── Style descriptions ─────────────────────────────────────────────────────────

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "minimal-luxury": "elegant, premium, aspirational",
  "dark-aesthetic": "bold, edgy, raw, intense",
  "wellness": "calm, nurturing, empowering",
  "clean-productivity": "clear, actionable, structured",
  "faceless-creator": "mysterious, relatable, scroll-stopping",
  "modern-business": "professional, confident, authoritative",
  "viral-storytelling": "cinematic, emotional, curiosity-driven",
  "aggressive-viral": "fast, bold, high-energy, TikTok-native",
  "educational-pro": "structured, swipe-worthy, saveable",
  "soft-feminine": "elegant, aesthetic, calming",
  "tech-minimal": "modern, AI/startup aesthetic",
  "luxury-editorial": "magazine-inspired, premium",
  "chaos-raw": "messy, authentic, internet-native",
  "quote-focus-style": "minimal, emotional, impactful",
};

// ── Per-platform CTA details ───────────────────────────────────────────────────

const PLATFORM_DETAILS: Record<string, {
  label: string; hasLink: boolean; captionStyle: string; hashtagCount: string; ctaExample: string;
}> = {
  instagram: { label: "Instagram", hasLink: true, captionStyle: "1–3 short punchy sentences (max 150 chars). Hook first. Emojis OK.", hashtagCount: "20–25 hashtags mixing broad, mid-tier, and niche", ctaExample: "Tap the link in bio to grab yours 🔗" },
  "tiktok-link": { label: "TikTok (Link in Bio)", hasLink: true, captionStyle: "Ultra-short, conversational, 1–2 sentences max. TikTok slang OK.", hashtagCount: "5–8 trending hashtags, max 3 niche", ctaExample: "Link in bio 👆 go check it out rn" },
  "tiktok-comment": { label: "TikTok (Comment Keyword)", hasLink: false, captionStyle: "Ultra-short caption. Ask viewers to comment a keyword to get the resource.", hashtagCount: "5–8 trending hashtags", ctaExample: "Comment 'GUIDE' below and I'll DM you instantly 💬" },
  linkedin: { label: "LinkedIn", hasLink: true, captionStyle: "Professional, value-first. 2–3 sentences. Opens with insight or stat.", hashtagCount: "3–5 professional hashtags", ctaExample: "Full breakdown in the link — worth 5 minutes." },
  pinterest: { label: "Pinterest", hasLink: true, captionStyle: "Descriptive and SEO-rich. 2–3 sentences. Keyword-rich, benefit-focused.", hashtagCount: "10–15 SEO-focused keyword hashtags", ctaExample: "Save this + tap the link for the full resource 📌" },
  facebook: { label: "Facebook", hasLink: true, captionStyle: "Warm, community-driven. 2–3 sentences. Ask a question to spark comments.", hashtagCount: "3–5 hashtags max", ctaExample: "Drop a comment or visit the link in bio 👇" },
  twitter: { label: "X (Twitter)", hasLink: true, captionStyle: "Sharp and opinionated. Max 240 chars. Bold statement or contrarian take.", hashtagCount: "2–3 hashtags inline", ctaExample: "Full thread in the link ↓" },
  threads: { label: "Threads", hasLink: true, captionStyle: "Conversational and reply-bait. 1–2 punchy sentences. End with a question.", hashtagCount: "3–5 hashtags or none", ctaExample: "What do you think? Drop your take below 👇" },
};

// ── Prompt builders ────────────────────────────────────────────────────────────

function buildHooksPrompt(topic: string, carouselType: CarouselType, styleDesc: string, niche?: string): string {
  return `You are a viral social media strategist specialising in high-performing carousel hooks.

Topic: "${topic}"
Carousel type: ${carouselType}
Style: ${styleDesc}
${niche ? `Target audience: ${niche}` : ""}

Generate 8 scroll-stopping hook options for slide 1 of this carousel.

Rules:
- Every hook = 3–8 words, ALL CAPS
- Be specific — use numbers, facts, or relatable situations
- Create FOMO, curiosity, or instant self-recognition
- NEVER use generic phrases like "TAKE CONTROL" or "UNLOCK YOUR POTENTIAL"
- Vary the approach: some use numbers, some use questions, some use bold statements

Return a JSON object:
{ "hooks": ["HOOK ONE", "HOOK TWO", "HOOK THREE", "HOOK FOUR", "HOOK FIVE", "HOOK SIX", "HOOK SEVEN", "HOOK EIGHT"] }`;
}

function buildCarouselPrompt(
  topic: string,
  carouselType: CarouselType,
  slideCount: number,
  selectedHook: string,
  styleDesc: string,
  niche?: string,
  tone?: string,
): string {
  const fw = FRAMEWORKS[carouselType];
  return `You are a viral social media carousel strategist. Generate a ${slideCount}-slide carousel that performs like the top 1% of social content.

Topic: "${topic}"
Carousel framework: ${fw.name}
Opening hook (slide 1): "${selectedHook}"
Visual style: ${styleDesc}
Tone hint: ${fw.toneHint}
${tone ? `Overall tone: ${tone}` : ""}
${niche ? `Target audience: ${niche}` : ""}

Framework structure to follow:
${fw.structure}

${COPY_RULES}

BACKGROUND THEME GUIDE:
- "dark" — dark, bold backgrounds
- "gradient-warm" — orange/red/gold gradients
- "gradient-cool" — blue/purple gradients
- "light" — clean white/off-white
- "cream" — warm cream/beige
- "sage" — muted green tones
- "navy" — deep blue

Return a JSON object:
{
  "framework": "${fw.name}",
  "slides": [
    {
      "hook": "EXACTLY THE SELECTED HOOK — DO NOT CHANGE IT",
      "mainText": "One punchy idea. Maximum 2 sentences.",
      "cta": "Swipe to see →",
      "bgTheme": "dark"
    }
  ],
  "qualityScore": {
    "scrollStopper": 85,
    "curiosity": 90,
    "readability": 88,
    "shareability": 82,
    "conversion": 79,
    "overall": 85,
    "weakSlides": [3],
    "suggestions": ["Slide 3 mainText could be shorter", "Add a specific number to slide 5"]
  }
}

Important:
- Slide 1 hook MUST be exactly: "${selectedHook}"
- Generate exactly ${slideCount} slides (including the CTA slide at the end)
- The last slide should have "isCta": true
- Vary bgTheme for visual interest
- Score each dimension honestly — do not give everything 90+`;
}

function buildAbCarouselPrompt(
  topic: string,
  carouselType: CarouselType,
  slideCount: number,
  hooks: string[],
  styleDesc: string,
  niche?: string,
): string {
  const fw = FRAMEWORKS[carouselType];
  const altHooks = hooks.slice(0, 3);
  return `You are a viral social media carousel strategist. Generate 3 completely different carousel concepts for A/B testing.

Topic: "${topic}"
Carousel type: ${carouselType} — Framework: ${fw.name}
Visual style: ${styleDesc}
${niche ? `Target audience: ${niche}` : ""}

${COPY_RULES}

Generate 3 variants:
- Variant A: Use hook "${altHooks[0] ?? hooks[0]}" — Follow the ${fw.name} framework
- Variant B: Use hook "${altHooks[1] ?? hooks[1]}" — Use a Storytelling / Before-After approach instead
- Variant C: Use hook "${altHooks[2] ?? hooks[2]}" — Use a Checklist / Step-by-step approach instead

Each variant should feel completely different in structure and energy, not just different hooks.

Return JSON:
{
  "variants": [
    {
      "id": "a",
      "hook": "...",
      "framework": "...",
      "styleHint": "bold and dark",
      "slides": [{ "hook": "...", "mainText": "...", "cta": "...", "bgTheme": "..." }],
      "qualityScore": { "scrollStopper": 0, "curiosity": 0, "readability": 0, "shareability": 0, "conversion": 0, "overall": 0, "weakSlides": [], "suggestions": [] }
    }
  ]
}

Each variant needs exactly ${slideCount} slides. Last slide has "isCta": true. Score honestly.`;
}

function buildSlideRegenPrompt(
  topic: string,
  carouselType: CarouselType,
  framework: string,
  slideIndex: number,
  slideCount: number,
  existingSlides: Array<{ hook: string; mainText: string }>,
  styleDesc: string,
  niche?: string,
): string {
  const slidesBefore = existingSlides.slice(0, slideIndex).map((s, i) => `Slide ${i + 1}: "${s.hook}" — "${s.mainText}"`).join("\n");
  const slidesAfter = existingSlides.slice(slideIndex + 1).map((s, i) => `Slide ${slideIndex + 2 + i}: "${s.hook}" — "${s.mainText}"`).join("\n");
  const isLast = slideIndex === slideCount - 1;

  return `You are a viral social media carousel strategist. Regenerate only slide ${slideIndex + 1} of a ${slideCount}-slide ${carouselType} carousel.

Topic: "${topic}"
Framework: ${framework}
Style: ${styleDesc}
${niche ? `Target audience: ${niche}` : ""}

Context (slides around the one you're regenerating):
${slidesBefore ? `BEFORE:\n${slidesBefore}` : "(this is the first slide)"}
${slidesAfter ? `AFTER:\n${slidesAfter}` : "(this is the last slide)"}

Slide ${slideIndex + 1} should: ${isLast ? "be a CTA slide that closes the carousel" : `continue the narrative arc — bridge what came before and set up what comes after`}

${COPY_RULES}

Return JSON:
{ "slide": { "hook": "...", "mainText": "...", "cta": "...", "bgTheme": "..."${isLast ? ', "isCta": true' : ""} } }`;
}

function buildPlatformCTAPrompt(
  platformId: string,
  topic: string,
  styleDesc: string,
  cfg: PlatformCfg | null,
  tone?: string,
): string {
  const pd = PLATFORM_DETAILS[platformId] ?? PLATFORM_DETAILS.instagram;
  const ctaAction = cfg
    ? cfg.ctaType === "custom" && cfg.ctaCustom
      ? `CTA action: "${cfg.ctaCustom}"`
      : cfg.ctaType === "comment-keyword"
      ? `CTA action: Comment keyword "${cfg.ctaKeyword || "GUIDE"}" trigger`
      : cfg.ctaType === "follow-for-more"
      ? "CTA action: Ask to follow"
      : cfg.ctaType === "visit-store"
      ? "CTA action: Visit store in bio"
      : `CTA action: ${pd.ctaExample}`
    : `CTA action: ${pd.ctaExample}`;

  return `You are a social media CTA copywriter for ${pd.label}. Generate a closing CTA slide + caption + hashtags.

Topic: "${topic}"
Style: ${styleDesc}
Tone: ${tone ?? "Inspirational"}
${ctaAction}
Caption style: ${pd.captionStyle}
Hashtags: ${pd.hashtagCount}

Return JSON with EXACTLY these fields:
{
  "ctaSlide": { "hook": "4–8 words ALL CAPS", "mainText": "1–2 sentences max, warm and direct", "cta": "5–15 words, platform-specific action", "bgTheme": "gradient-warm" },
  "caption": "platform-optimised caption",
  "hashtags": ["#tag1", "#tag2"]
}`;
}

function buildBulkTopicPrompt(topic: string, count: number, styleDesc: string, niche?: string, tone?: string): string {
  return `You are a viral social media content strategist.

Generate exactly ${count} unique social media posts for: "${topic}"
Style: ${styleDesc}
Tone: ${tone ?? "Inspirational"}
${niche ? `Audience: ${niche}` : ""}

Return JSON with a "posts" array. Each element:
- hook: scroll-stopping headline (5–12 words, ALL CAPS, specific — NO generic phrases)
- mainText: core value (30–60 words, 2–3 short sentences)
- cta: slide nudge (3–8 words, e.g. "Swipe to see →")
- bgTheme: one of: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"`;
}

function buildBulkProductsPrompt(products: ProductInput[], count: number, styleDesc: string, tone?: string): string {
  const list = products.map((p, i) => `${i + 1}. "${p.title}" (${p.format}${p.niche ? ` · ${p.niche}` : ""})`).join("\n");
  return `You are a viral social media content strategist for digital product promotion.

Products:
${list}

Generate exactly ${count} posts promoting these products.
Style: ${styleDesc}
Tone: ${tone ?? "Promotional"}

Return JSON with a "posts" array. Each element:
- hook: scroll-stopping (5–12 words, ALL CAPS, NO generic phrases)
- mainText: sell the transformation (30–60 words, 2–3 sentences, NO product name in body)
- cta: slide nudge (3–8 words)
- bgTheme: one of: "dark", "light", "cream", "sage", "navy", "gradient-warm", "gradient-cool"
- productTitle: exact product title this post is for`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callAI(apiKey: string, prompt: string, maxTokens = 3000): Promise<string | null> {
  const res = await fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

function parseSlides(arr: unknown[]): SlideRow[] {
  return arr.map((item) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      hook: typeof o.hook === "string" ? o.hook : "",
      mainText: typeof o.mainText === "string" ? o.mainText : "",
      cta: typeof o.cta === "string" ? o.cta : "Swipe →",
      bgTheme: typeof o.bgTheme === "string" ? o.bgTheme : "dark",
      isCta: o.isCta === true,
    };
  });
}

function parseQuality(raw: unknown): QualityScore {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    scrollStopper: typeof o.scrollStopper === "number" ? o.scrollStopper : 75,
    curiosity:     typeof o.curiosity     === "number" ? o.curiosity     : 75,
    readability:   typeof o.readability   === "number" ? o.readability   : 75,
    shareability:  typeof o.shareability  === "number" ? o.shareability  : 75,
    conversion:    typeof o.conversion    === "number" ? o.conversion    : 75,
    overall:       typeof o.overall       === "number" ? o.overall       : 75,
    weakSlides:    Array.isArray(o.weakSlides) ? (o.weakSlides as number[]) : [],
    suggestions:   Array.isArray(o.suggestions) ? (o.suggestions as string[]) : [],
  };
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    // Mode selection
    mode?: "hooks" | "carousel" | "ab" | "slide-regen" | "bulk";
    // Carousel params
    topic?: string;
    carouselType?: CarouselType;
    slideCount?: number;
    selectedHook?: string;
    generatedHooks?: string[];
    style?: string;
    niche?: string;
    tone?: string;
    // Slide regen params
    slideIndex?: number;
    framework?: string;
    existingSlides?: Array<{ hook: string; mainText: string }>;
    // Bulk/legacy params
    count?: number;
    products?: ProductInput[];
    platforms?: string[];
    ctaStrategy?: "ai" | "manual";
    perPlatformCta?: Record<string, PlatformCfg>;
  };

  const mode = body.mode ?? "bulk";
  const style = typeof body.style === "string" ? body.style : "minimal-luxury";
  const styleDesc = STYLE_DESCRIPTIONS[style] ?? "engaging and professional";
  const niche = typeof body.niche === "string" ? body.niche.trim() : undefined;
  const tone = typeof body.tone === "string" ? body.tone : undefined;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const carouselType: CarouselType = (body.carouselType ?? "instagram") as CarouselType;

  // ── MODE: hooks — generate 5-10 hook options ─────────────────────────────────
  if (mode === "hooks") {
    if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });
    const raw = await callAI(apiKey, buildHooksPrompt(topic, carouselType, styleDesc, niche), 800);
    if (!raw) return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    try {
      const parsed = JSON.parse(raw) as { hooks?: string[] };
      const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.filter((h): h is string => typeof h === "string") : [];
      return NextResponse.json({ hooks });
    } catch {
      return NextResponse.json({ error: "Parse failed" }, { status: 500 });
    }
  }

  // ── MODE: carousel — generate full carousel ───────────────────────────────────
  if (mode === "carousel") {
    if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });
    const slideCount = Math.min(Math.max(Number(body.slideCount) || 7, 3), 20);
    const selectedHook = typeof body.selectedHook === "string" ? body.selectedHook : "";
    const platforms = Array.isArray(body.platforms) && body.platforms.length > 0 ? body.platforms : ["instagram"];
    const ctaStrategy = body.ctaStrategy === "manual" ? "manual" : "ai";
    const perPlatformCta: Record<string, PlatformCfg> = body.perPlatformCta ?? {};

    // Build platform CTA prompts
    const platformPrompts = platforms.map((pid) =>
      buildPlatformCTAPrompt(
        pid, topic, styleDesc,
        ctaStrategy === "manual" && perPlatformCta[pid] ? perPlatformCta[pid] : null,
        tone,
      )
    );

    const [carouselRaw, ...platformRaws] = await Promise.all([
      callAI(apiKey, buildCarouselPrompt(topic, carouselType, slideCount, selectedHook, styleDesc, niche, tone), 4000),
      ...platformPrompts.map((p) => callAI(apiKey, p, 900)),
    ]);

    if (!carouselRaw) return NextResponse.json({ error: "AI request failed" }, { status: 502 });

    let slides: SlideRow[] = [];
    let framework = FRAMEWORKS[carouselType].name;
    let qualityScore: QualityScore | null = null;

    try {
      const parsed = JSON.parse(carouselRaw) as { slides?: unknown[]; framework?: string; qualityScore?: unknown };
      slides = parseSlides(Array.isArray(parsed.slides) ? parsed.slides : []);
      if (typeof parsed.framework === "string") framework = parsed.framework;
      if (parsed.qualityScore) qualityScore = parseQuality(parsed.qualityScore);
    } catch {
      return NextResponse.json({ error: "Failed to parse carousel" }, { status: 500 });
    }

    // Parse platform outputs
    const platformOutputs: Array<{
      platformId: string;
      caption: string;
      hashtags: string[];
      ctaSlide: Record<string, unknown> | null;
    }> = [];

    for (let i = 0; i < platforms.length; i++) {
      const pid = platforms[i];
      const raw = platformRaws[i];
      let caption = "", hashtags: string[] = [], ctaSlide: Record<string, unknown> | null = null;
      if (raw) {
        try {
          const p = JSON.parse(raw) as { ctaSlide?: Record<string, unknown>; caption?: string; hashtags?: string[] };
          ctaSlide = p.ctaSlide ? { ...p.ctaSlide, isCta: true } : null;
          caption = typeof p.caption === "string" ? p.caption : "";
          hashtags = Array.isArray(p.hashtags) ? p.hashtags.filter((h): h is string => typeof h === "string") : [];
        } catch { /* non-fatal */ }
      }
      platformOutputs.push({ platformId: pid, caption, hashtags, ctaSlide });
    }

    return NextResponse.json({ slides, framework, qualityScore, platformOutputs });
  }

  // ── MODE: ab — generate 3 carousel variants ───────────────────────────────────
  if (mode === "ab") {
    if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });
    const slideCount = Math.min(Math.max(Number(body.slideCount) || 7, 3), 15);
    const generatedHooks = Array.isArray(body.generatedHooks) ? body.generatedHooks : [];

    const raw = await callAI(
      apiKey,
      buildAbCarouselPrompt(topic, carouselType, slideCount, generatedHooks, styleDesc, niche),
      6000,
    );
    if (!raw) return NextResponse.json({ error: "AI request failed" }, { status: 502 });

    try {
      const parsed = JSON.parse(raw) as {
        variants?: Array<{
          id: string;
          hook: string;
          framework: string;
          styleHint: string;
          slides: unknown[];
          qualityScore: unknown;
        }>;
      };
      const variants = (parsed.variants ?? []).map((v) => ({
        id: v.id,
        hook: v.hook,
        framework: v.framework,
        styleHint: v.styleHint,
        slides: parseSlides(Array.isArray(v.slides) ? v.slides : []),
        qualityScore: parseQuality(v.qualityScore),
      }));
      return NextResponse.json({ variants });
    } catch {
      return NextResponse.json({ error: "Parse failed" }, { status: 500 });
    }
  }

  // ── MODE: slide-regen — regenerate one slide ──────────────────────────────────
  if (mode === "slide-regen") {
    if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });
    const slideIndex = typeof body.slideIndex === "number" ? body.slideIndex : 0;
    const slideCount = typeof body.slideCount === "number" ? body.slideCount : 7;
    const framework = typeof body.framework === "string" ? body.framework : FRAMEWORKS[carouselType].name;
    const existingSlides = Array.isArray(body.existingSlides) ? body.existingSlides : [];

    const raw = await callAI(
      apiKey,
      buildSlideRegenPrompt(topic, carouselType, framework, slideIndex, slideCount, existingSlides, styleDesc, niche),
      600,
    );
    if (!raw) return NextResponse.json({ error: "AI request failed" }, { status: 502 });

    try {
      const parsed = JSON.parse(raw) as { slide?: Record<string, unknown> };
      if (!parsed.slide) return NextResponse.json({ error: "No slide in response" }, { status: 500 });
      const slide: SlideRow = {
        hook: typeof parsed.slide.hook === "string" ? parsed.slide.hook : "",
        mainText: typeof parsed.slide.mainText === "string" ? parsed.slide.mainText : "",
        cta: typeof parsed.slide.cta === "string" ? parsed.slide.cta : "Swipe →",
        bgTheme: typeof parsed.slide.bgTheme === "string" ? parsed.slide.bgTheme : "dark",
        isCta: parsed.slide.isCta === true,
      };
      return NextResponse.json({ slide });
    } catch {
      return NextResponse.json({ error: "Parse failed" }, { status: 500 });
    }
  }

  // ── MODE: bulk (legacy) — standalone posts ────────────────────────────────────
  {
    const count = Math.min(Math.max(Number(body.count) || 10, 5), 30);
    const products = Array.isArray(body.products) && body.products.length > 0 ? body.products : null;
    const platforms = Array.isArray(body.platforms) && body.platforms.length > 0 ? body.platforms : ["instagram"];
    const ctaStrategy = body.ctaStrategy === "manual" ? "manual" : "ai";
    const perPlatformCta: Record<string, PlatformCfg> = body.perPlatformCta ?? {};

    if (!products && !topic) return NextResponse.json({ error: "topic or products required" }, { status: 400 });

    const topicForCta = products ? products.map((p) => p.title).join(", ") : topic;
    const contentPrompt = products
      ? buildBulkProductsPrompt(products, count, styleDesc, tone)
      : buildBulkTopicPrompt(topic, count, styleDesc, niche, tone);

    const platformPrompts = platforms.map((pid) =>
      buildPlatformCTAPrompt(
        pid, topicForCta, styleDesc,
        ctaStrategy === "manual" && perPlatformCta[pid] ? perPlatformCta[pid] : null,
        tone,
      )
    );

    const [contentRes, ...platformReses] = await Promise.all([
      fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: contentPrompt }], response_format: { type: "json_object" }, temperature: 0.85, max_tokens: 6000 }),
      }),
      ...platformPrompts.map((p) =>
        fetchOpenAIWithRetry("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: p }], response_format: { type: "json_object" }, temperature: 0.7, max_tokens: 900 }),
        })
      ),
    ]);

    if (!contentRes.ok) {
      const err = await contentRes.text();
      return NextResponse.json({ error: "AI request failed", details: err.slice(0, 200) }, { status: 502 });
    }

    const contentData = await contentRes.json() as { choices?: { message?: { content?: string } }[] };
    const contentText = contentData.choices?.[0]?.message?.content;
    if (!contentText) return NextResponse.json({ error: "No AI response" }, { status: 502 });

    let posts: unknown[] = [];
    try {
      const parsed = JSON.parse(contentText) as { posts?: unknown[] };
      posts = Array.isArray(parsed.posts) ? parsed.posts : [];
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const platformOutputs: Array<{
      platformId: string; caption: string; hashtags: string[]; ctaSlide: Record<string, unknown> | null;
    }> = [];

    for (let i = 0; i < platforms.length; i++) {
      const pid = platforms[i];
      const res = platformReses[i];
      let caption = "", hashtags: string[] = [], ctaSlide: Record<string, unknown> | null = null;
      if (res && res.ok) {
        try {
          const data = await res.json() as { choices?: { message?: { content?: string } }[] };
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            const p = JSON.parse(text) as { ctaSlide?: Record<string, unknown>; caption?: string; hashtags?: string[] };
            ctaSlide = p.ctaSlide ? { ...p.ctaSlide, isCta: true } : null;
            caption = typeof p.caption === "string" ? p.caption : "";
            hashtags = Array.isArray(p.hashtags) ? p.hashtags.filter((h): h is string => typeof h === "string") : [];
          }
        } catch { /* non-fatal */ }
      }
      platformOutputs.push({ platformId: pid, caption, hashtags, ctaSlide });
    }

    return NextResponse.json({ posts, platformOutputs });
  }
}
