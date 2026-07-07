/**
 * POST /api/launch/marketing
 * ─────────────────────────────
 * Streaming full campaign generation for the AI Execution pipeline (Phase 1.5).
 *
 * Generates a complete marketing package in 3 sequential GPT-4o-mini calls,
 * then streams folder-asset events so the dashboard shows assets appearing live.
 *
 * Stream event sequence:
 *   step              — named step starting
 *   step-done         — named step complete
 *   folder-asset      — { category, assetId, label, preview } — asset ready, show it
 *   done              — { marketing } — full marketing data
 *   error             — fatal error
 *
 * Three GPT calls:
 *   1. Launch Campaign   — sales copy, marketplace desc, store desc, SEO, tags,
 *                          launch announcement, FAQ, CTAs, promotional headlines
 *   2. Social Media      — 10 carousel posts, 10 TikTok hooks, 10 X posts, 10 IG captions
 *   3. Email Campaigns   — 5 emails (Welcome, Launch, Reminder, Last Chance, Thank You)
 *
 * Saves to productsTable.marketingAssets:
 *   productTitle, productDescription, hashtags, seoKeywords
 */

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

/* ─── Input shape ─────────────────────────────────────────────────────────────── */

interface MarketingInput {
  productId:    string;
  productName:  string;
  niche:        string;
  format:       string;
  pricePoint?:  string;
  goal:         string;
  // From research stage
  reportSummary?:       string;
  insights?:            string[];
  keywords?:            Array<{ term: string; intent: string; opportunity: string; note: string }>;
  competitorInsights?:  Array<{ name: string; strength: string; gap: string }>;
  productOpportunities?: Array<{ title: string; description: string; type: string; priceRange: string }>;
  actionPlan?:          Array<{ step: number; action: string; detail: string }>;
}

/* ─── GPT helper ─────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGPT(
  systemPrompt: string,
  userPrompt:   string,
  apiKey:       string,
  maxTokens:    number = 2500,
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({
      model:           "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      response_format: { type: "json_object" },
      temperature:     0.85,
      max_tokens:      maxTokens,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);

  const data  = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw   = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}

/* ─── Context builder ────────────────────────────────────────────────────────── */

function buildContext(input: MarketingInput): string {
  const parts: string[] = [
    `Product: "${input.productName}" (${input.format})`,
    `Niche: ${input.niche}`,
    `Price: ${input.pricePoint ?? "TBD"}`,
    `Goal: ${input.goal}`,
  ];

  if (input.reportSummary) {
    parts.push(`Market Summary: ${input.reportSummary.slice(0, 500)}`);
  }
  if (input.insights?.length) {
    parts.push(`Key Insights: ${input.insights.slice(0, 5).join(" | ")}`);
  }
  if (input.keywords?.length) {
    const highOpp = input.keywords.filter(k => k.opportunity === "High").slice(0, 6).map(k => k.term);
    if (highOpp.length) parts.push(`High-Value Keywords: ${highOpp.join(", ")}`);
  }
  if (input.competitorInsights?.length) {
    parts.push(`Competitor Gaps: ${input.competitorInsights.slice(0, 3).map(c => `${c.name}: ${c.gap}`).join(" | ")}`);
  }

  return parts.join("\n");
}

/* ─── Call 1: Launch Campaign ────────────────────────────────────────────────── */

async function generateLaunchCampaign(input: MarketingInput, apiKey: string) {
  const ctx = buildContext(input);

  const system = `You are an elite digital product launch copywriter and SEO specialist.
Write copy that converts. Be specific, avoid generic filler phrases.
Return ONLY valid JSON — no markdown, no extra keys.`;

  const user = `${ctx}

Generate a complete launch campaign package. Return this exact JSON:
{
  "salesCopy": {
    "headline": "Bold, benefit-driven main headline (10-14 words)",
    "subheadline": "Supporting line that clarifies the promise (15-25 words)",
    "body": "Two-paragraph sales page opener: Problem the buyer has → How this product solves it → Transformation they get. No filler phrases."
  },
  "marketplaceDesc": "3-paragraph marketplace description: hook paragraph (problem/desire), value paragraph (what they get, be specific), closing paragraph (CTA). 180-240 words total.",
  "storeDesc": "1-paragraph store description, compelling and direct. 60-80 words.",
  "seoTitle": "SEO title under 60 chars including the product name and primary keyword",
  "seoMetaDesc": "SEO meta description 140-160 chars — specific, includes a CTA",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "launchAnnouncement": "Tweet announcing the launch — punchy, specific result mentioned, under 240 chars, no hashtags in body",
  "faq": [
    {"q": "Who is this for?", "a": "Specific answer"},
    {"q": "What's included?", "a": "Specific answer"},
    {"q": "How quickly will I see results?", "a": "Honest, specific answer"},
    {"q": "Is there a money-back guarantee?", "a": "Specific answer"},
    {"q": "Why this and not something free?", "a": "Specific differentiator answer"}
  ],
  "ctas": ["CTA 1 (action verb + outcome)", "CTA 2", "CTA 3", "CTA 4", "CTA 5"],
  "headlines": ["Alt headline 1", "Alt headline 2", "Alt headline 3", "Alt headline 4", "Alt headline 5"]
}`;

  return callGPT(system, user, apiKey, 2000);
}

/* ─── Call 2: Social Media ───────────────────────────────────────────────────── */

async function generateSocialMedia(input: MarketingInput, apiKey: string) {
  const ctx = buildContext(input);

  const system = `You are a viral social media content strategist. Write platform-native content that feels human and specific.
Rules: every hook must include a specific number, outcome or situation. No generic motivation. Write like a real creator.
Return ONLY valid JSON.`;

  const user = `${ctx}

Generate a full social media content pack. Return this exact JSON:
{
  "carousels": [
    {"hook": "Slide 1 scroll-stopper hook", "slides": ["Slide 2 text", "Slide 3 text", "Slide 4 text", "Slide 5 text", "Slide 6 CTA"]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]},
    {"hook": "...", "slides": ["...", "...", "...", "...", "..."]}
  ],
  "tiktokHooks": [
    "Hook 1 — opening 3-second line for a TikTok video, creates curiosity or pattern interrupt",
    "Hook 2", "Hook 3", "Hook 4", "Hook 5", "Hook 6", "Hook 7", "Hook 8", "Hook 9", "Hook 10"
  ],
  "xPosts": [
    "X post 1 — under 240 chars, punchy, no hashtags in body, ends with a provocative statement or question",
    "X post 2", "X post 3", "X post 4", "X post 5",
    "X post 6", "X post 7", "X post 8", "X post 9", "X post 10"
  ],
  "instagramCaptions": [
    "Instagram caption 1 — 120-200 words. Hook first line, story in middle, CTA at end. Line-break friendly.",
    "Caption 2", "Caption 3", "Caption 4", "Caption 5",
    "Caption 6", "Caption 7", "Caption 8", "Caption 9", "Caption 10"
  ]
}`;

  return callGPT(system, user, apiKey, 3500);
}

/* ─── Call 3: Email Campaigns ────────────────────────────────────────────────── */

async function generateEmailCampaigns(input: MarketingInput, apiKey: string) {
  const ctx = buildContext(input);

  const system = `You are an email marketing specialist. Write emails that feel personal, not salesy.
Each email must have a clear job in the sequence: Welcome (build trust), Launch (create excitement + FOMO), Reminder (urgency), Last Chance (scarcity), Thank You (deliver value + upsell).
Return ONLY valid JSON.`;

  const user = `${ctx}

Generate a 5-email launch sequence. Return this exact JSON:
{
  "emails": [
    {
      "name": "Welcome",
      "subject": "Subject line under 55 chars — personal tone",
      "preview": "Preview text 40-90 chars — complements the subject",
      "body": "300-400 word email body. Opens with 'Hi [FirstName],' — warm, personal, sets expectations, delivers immediate value (one actionable tip or insight). Ends with CTA that feels natural."
    },
    {
      "name": "Launch",
      "subject": "Launch announcement subject — excitement without hype",
      "preview": "Preview text",
      "body": "300-400 words. Announces the product is live. Specific benefits. Story or social proof. Clear CTA with the price and link placeholder."
    },
    {
      "name": "Reminder",
      "subject": "Reminder subject — addresses a common objection",
      "preview": "Preview text",
      "body": "250-350 words. Handles the #1 objection (fear/doubt). Reassures. FAQ answer. Softer CTA."
    },
    {
      "name": "Last Chance",
      "subject": "Last chance subject — genuine scarcity (price going up or closing)",
      "preview": "Preview text",
      "body": "200-300 words. Honest urgency. Short, punchy paragraphs. Strong CTA. P.S. line."
    },
    {
      "name": "Thank You",
      "subject": "Thank you subject — for buyers, deliver immediate value",
      "preview": "Preview text",
      "body": "250-350 words. Thank the buyer. Tell them exactly what to do next (access link). One quick win they can get today. Soft mention of next product/upsell."
    }
  ]
}`;

  return callGPT(system, user, apiKey, 3000);
}

/* ─── Streaming generator ────────────────────────────────────────────────────── */

function streamMarketingGeneration(
  userId:  string,
  input:   MarketingInput,
  apiKey:  string,
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer closed */ }
  };

  void (async () => {
    // Accumulated full marketing data
    const marketing: Record<string, unknown> = {};

    try {
      /* ── Step 0: Read context ── */
      await send({ type: "step", id: "read-context", label: "Reading product & research..." });
      await send({ type: "step-done", id: "read-context" });

      /* ── Step 1: Audience analysis ── */
      await send({ type: "step", id: "audience", label: "Analysing audience & positioning..." });
      await send({ type: "step-done", id: "audience" });

      /* ── Step 2: Launch Campaign ── */
      await send({ type: "step", id: "launch-content", label: "Writing launch campaign..." });

      let launchData: Record<string, unknown> = {};
      try {
        launchData = await generateLaunchCampaign(input, apiKey);
      } catch (e) {
        console.error("[launch/marketing] Launch campaign failed:", e);
      }

      // Assign to marketing
      const salesCopy = launchData.salesCopy as { headline?: string; subheadline?: string; body?: string } | undefined;
      marketing.salesCopy          = salesCopy;
      marketing.marketplaceDesc    = launchData.marketplaceDesc;
      marketing.storeDesc          = launchData.storeDesc;
      marketing.seoTitle           = launchData.seoTitle;
      marketing.seoMetaDesc        = launchData.seoMetaDesc;
      marketing.tags               = launchData.tags;
      marketing.launchAnnouncement = launchData.launchAnnouncement;
      marketing.faq                = launchData.faq;
      marketing.ctas               = launchData.ctas;
      marketing.headlines          = launchData.headlines;

      // Stream each launch asset with 80ms gap
      const launchAssets: Array<{ id: string; label: string; preview: string }> = [
        { id: "sales-copy",    label: "Sales Page Copy",         preview: salesCopy?.headline ?? "✓" },
        { id: "marketplace",   label: "Marketplace Description", preview: truncate(String(launchData.marketplaceDesc ?? ""), 90) },
        { id: "store-desc",    label: "Store Description",       preview: truncate(String(launchData.storeDesc ?? ""), 90) },
        { id: "seo",           label: "SEO Package",             preview: String(launchData.seoTitle ?? "") },
        { id: "tags",          label: "Product Tags",            preview: (launchData.tags as string[] | undefined)?.slice(0, 4).join(" · ") ?? "" },
        { id: "announcement",  label: "Launch Announcement",     preview: truncate(String(launchData.launchAnnouncement ?? ""), 90) },
        { id: "faq",           label: "FAQ (5 Q&As)",            preview: `Q: ${(launchData.faq as Array<{q:string;a:string}>|undefined)?.[0]?.q ?? ""}` },
        { id: "ctas",          label: "Calls to Action",         preview: (launchData.ctas as string[] | undefined)?.[0] ?? "" },
        { id: "headlines",     label: "Promotional Headlines",   preview: (launchData.headlines as string[] | undefined)?.[0] ?? "" },
      ];

      for (const asset of launchAssets) {
        await send({ type: "folder-asset", category: "launch", ...asset });
        await sleep(80);
      }

      await send({ type: "step-done", id: "launch-content" });

      /* ── Step 3: Social Media ── */
      await send({ type: "step", id: "social-content", label: "Generating social media content..." });

      let socialData: Record<string, unknown> = {};
      try {
        socialData = await generateSocialMedia(input, apiKey);
      } catch (e) {
        console.error("[launch/marketing] Social media failed:", e);
      }

      marketing.carousels          = socialData.carousels;
      marketing.tiktokHooks        = socialData.tiktokHooks;
      marketing.xPosts             = socialData.xPosts;
      marketing.instagramCaptions  = socialData.instagramCaptions;

      const carousels   = (socialData.carousels         as Array<{hook:string}> | undefined) ?? [];
      const tiktoks     = (socialData.tiktokHooks        as string[]             | undefined) ?? [];
      const xPosts      = (socialData.xPosts             as string[]             | undefined) ?? [];
      const igCaptions  = (socialData.instagramCaptions  as string[]             | undefined) ?? [];

      // Stream first 3 of each, then batch the rest
      const socialAssets: Array<{ id: string; label: string; preview: string }> = [
        ...carousels.slice(0, 10).map((c, i) => ({
          id: `carousel-${i + 1}`, label: `Carousel ${i + 1}`, preview: truncate(c.hook, 80),
        })),
        ...tiktoks.slice(0, 10).map((t, i) => ({
          id: `tiktok-${i + 1}`, label: `TikTok Hook ${i + 1}`, preview: truncate(t, 80),
        })),
        ...xPosts.slice(0, 10).map((p, i) => ({
          id: `x-${i + 1}`, label: `X Post ${i + 1}`, preview: truncate(p, 80),
        })),
        ...igCaptions.slice(0, 10).map((c, i) => ({
          id: `ig-${i + 1}`, label: `Instagram Caption ${i + 1}`, preview: truncate(c, 80),
        })),
      ];

      for (const asset of socialAssets) {
        await send({ type: "folder-asset", category: "social", ...asset });
        await sleep(60);
      }

      await send({ type: "step-done", id: "social-content" });

      /* ── Step 4: Email Campaigns ── */
      await send({ type: "step", id: "email-content", label: "Drafting email campaigns..." });

      let emailData: Record<string, unknown> = {};
      try {
        emailData = await generateEmailCampaigns(input, apiKey);
      } catch (e) {
        console.error("[launch/marketing] Email campaigns failed:", e);
      }

      marketing.emails = emailData.emails;

      const emails = (emailData.emails as Array<{name:string;subject:string;preview:string;body:string}> | undefined) ?? [];
      for (const email of emails) {
        await send({
          type:     "folder-asset",
          category: "email",
          id:       `email-${email.name.toLowerCase().replace(/\s/g, "-")}`,
          label:    `${email.name} Email`,
          preview:  email.subject,
        });
        await sleep(80);
      }

      await send({ type: "step-done", id: "email-content" });

      /* ── Step 5: Save to product record ── */
      await send({ type: "step", id: "saving", label: "Saving to marketing library..." });

      const currentProduct = await db
        .select({ marketingAssets: productsTable.marketingAssets })
        .from(productsTable)
        .where(and(eq(productsTable.id, input.productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(1);

      if (currentProduct[0]) {
        const existing = (currentProduct[0].marketingAssets ?? {}) as Record<string, unknown>;
        const updated = {
          ...existing,
          productTitle:       input.productName,
          productDescription: String(marketing.marketplaceDesc ?? ""),
          hashtags:           (marketing.tags as string[] | undefined) ?? [],
          seoKeywords:        (marketing.tags as string[] | undefined) ?? [],
        };

        await db
          .update(productsTable)
          .set({ marketingAssets: updated, updatedAt: new Date() })
          .where(and(eq(productsTable.id, input.productId), eq(productsTable.userId, userId)));
      }

      await send({ type: "step-done", id: "saving" });

      await send({ type: "done", marketing });

    } catch (err) {
      console.error("[launch/marketing]", err);
      await send({ type: "error", message: err instanceof Error ? err.message : String(err) }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "application/x-ndjson; charset=utf-8",
      "Cache-Control":     "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/* ─── POST handler ───────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });

    const body = await request.json().catch(() => ({})) as Partial<MarketingInput>;

    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) return new Response(JSON.stringify({ error: "productId required" }), { status: 400 });

    const input: MarketingInput = {
      productId,
      productName:          typeof body.productName === "string"          ? body.productName.trim()    : "My Product",
      niche:                typeof body.niche       === "string"          ? body.niche.trim()          : "digital products",
      format:               typeof body.format      === "string"          ? body.format.trim()         : "guide",
      pricePoint:           typeof body.pricePoint  === "string"          ? body.pricePoint.trim()     : "£27",
      goal:                 typeof body.goal        === "string"          ? body.goal.trim()           : "",
      reportSummary:        typeof body.reportSummary === "string"        ? body.reportSummary         : undefined,
      insights:             Array.isArray(body.insights)                  ? body.insights as string[]  : [],
      keywords:             Array.isArray(body.keywords)                  ? body.keywords              : [],
      competitorInsights:   Array.isArray(body.competitorInsights)        ? body.competitorInsights    : [],
      productOpportunities: Array.isArray(body.productOpportunities)      ? body.productOpportunities  : [],
      actionPlan:           Array.isArray(body.actionPlan)                ? body.actionPlan            : [],
    };

    return streamMarketingGeneration(userId, input, apiKey);

  } catch (err) {
    console.error("[launch/marketing]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
