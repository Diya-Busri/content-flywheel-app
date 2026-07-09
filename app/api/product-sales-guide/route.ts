export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { cleanProductTitle } from "@/lib/product-title";

export type ProductSalesGuide = {
  productOverview: {
    productName: string;
    format: string;
    targetCustomer: string;
    transformation: string;
  };
  painPoints: string[];
  solutions: Array<{ pain: string; solution: string }>;
  keyBenefits: string[];
  objections: Array<{ objection: string; answer: string }>;
  hooks: Array<{ text: string; whyItWorks: string; type?: string }>;
  ctas: Array<{ text: string; whyItWorks: string }>;
  pricingPsychology: string[];
  idealCustomerProfile: string[];
  contentStrategy: string[];
  launchStrategy: string[];
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const rawTitle = typeof body.productTitle === "string" ? body.productTitle.trim() : "";
    const productTitle = cleanProductTitle(rawTitle) || rawTitle;
    const productType = typeof body.productType === "string" ? body.productType : "";
    const productIncluded = typeof body.productIncluded === "string" ? body.productIncluded : "";
    const productWhy = typeof body.productWhy === "string" ? body.productWhy : "";
    const productPrice = typeof body.productPrice === "string" ? body.productPrice : "";
    const nicheName = typeof body.nicheName === "string" ? body.nicheName : "";
    const goal = typeof body.goal === "string" ? body.goal : "";

    if (!productTitle) {
      return NextResponse.json(
        { error: "Missing product title" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const prompt = `Create a complete, specific sales strategy for this digital product. Every section must be tailored to this exact product and buyer — not generic digital product advice.

PRODUCT DETAILS:
- Name: "${productTitle}"
- Format: ${productType || "Digital product"}
- Price: ${productPrice || "Not specified"}
- What's inside: ${productIncluded || "Not specified"}
- Why it sells: ${productWhy || "Not specified"}
- Niche: ${nicheName || "General"}
- Creator's goal: ${goal || "Sell the product"}

CRITICAL RULES:
- Never say "feeling overwhelmed", "achieve your goals", "take your journey to the next level" — these are meaningless filler
- Never invent statistics, percentages, or precise numbers you cannot know
- Every pain point must sound like something this specific buyer would say out loud
- Every hook must work as a real opening line of a short-form video or caption
- Every CTA must describe a specific funnel action (not just "link in bio")
- contentStrategy must explain the full path from content → sale, not just name the platform
- If something could apply to ANY digital product, it's not specific enough — rewrite it

Return ONLY this exact JSON structure (no markdown, no code fences):

{
  "productOverview": {
    "productName": "${productTitle}",
    "format": "Exact format description",
    "targetCustomer": "The specific person this is for — describe their life situation, role, and the specific problem that makes them buy (2 sentences)",
    "transformation": "The before/after this product delivers — written as a promise. E.g. 'Go from guessing what to cook every Sunday to having a full week of nurse-friendly meals prepped in 90 minutes, even after a 12-hour shift.'"
  },
  "painPoints": [
    "Pain point phrased in the buyer's own voice — something they'd say to a friend, not clinical language. E.g. 'I write a shopping list and still end up ordering takeaway by Wednesday.'",
    "...",
    "...",
    "...",
    "...",
    "..."
  ],
  "solutions": [
    {"pain": "exact pain from above", "solution": "How a specific part of ${productTitle} solves this — name what's in the product that addresses it"},
    {"pain": "...", "solution": "..."}
  ],
  "keyBenefits": [
    "Benefit written as an outcome the buyer achieves, not a feature. E.g. 'Stop spending Sunday afternoon staring at an empty fridge — the 12-week meal grid is already structured for shift patterns.'",
    "...",
    "...",
    "...",
    "...",
    "...",
    "...",
    "..."
  ],
  "objections": [
    {
      "objection": "Real objection this specific buyer has — e.g. 'I can find free meal plans on Pinterest for free'",
      "answer": "Specific answer that references what's in the product. Don't just say 'it's worth it' — explain exactly why this product solves something the free alternative doesn't."
    },
    {"objection": "...", "answer": "..."},
    {"objection": "...", "answer": "..."},
    {"objection": "...", "answer": "..."},
    {"objection": "...", "answer": "..."}
  ],
  "hooks": [
    {"type": "curiosity", "text": "Hook as a real opening line — max 15 words, punchy, could be spoken or captioned. E.g. 'The reason your meal prep fails has nothing to do with motivation.'", "whyItWorks": "Which psychology mechanism this triggers for THIS specific audience and why it stops the scroll"},
    {"type": "curiosity", "text": "...", "whyItWorks": "..."},
    {"type": "problem", "text": "Opens by stating a specific pain this buyer recognises immediately", "whyItWorks": "..."},
    {"type": "problem", "text": "...", "whyItWorks": "..."},
    {"type": "story", "text": "Opens with a relatable moment or scenario this buyer has lived", "whyItWorks": "..."},
    {"type": "story", "text": "...", "whyItWorks": "..."},
    {"type": "contrarian", "text": "Challenges a common belief this buyer holds", "whyItWorks": "..."},
    {"type": "contrarian", "text": "...", "whyItWorks": "..."},
    {"type": "authority", "text": "Establishes credibility or result without sounding boastful", "whyItWorks": "..."},
    {"type": "authority", "text": "...", "whyItWorks": "..."}
  ],
  "ctas": [
    {"text": "Specific CTA with a clear action — e.g. 'Comment NURSE below and I'll DM you the free meal prep starter checklist'", "whyItWorks": "Why this specific CTA works for this audience and what funnel step it achieves"},
    {"text": "...", "whyItWorks": "..."},
    {"text": "...", "whyItWorks": "..."},
    {"text": "...", "whyItWorks": "..."},
    {"text": "...", "whyItWorks": "..."},
    {"text": "...", "whyItWorks": "..."}
  ],
  "pricingPsychology": [
    "Why this specific price point is psychologically correct for this buyer (think about their income, the cost of the alternative, how often they face this problem)",
    "Whether to end in .99 or use a round number — and why, for this audience",
    "What the buyer compares this price to (the cost of takeaways, apps, a failed gym membership)",
    "Whether a bundle or upsell at this price point makes sense and what it would look like"
  ],
  "idealCustomerProfile": [
    "Who they are: specific demographics and life situation",
    "Where they spend time online: specific platforms, subreddits, Facebook groups, TikTok hashtags this buyer actually uses",
    "What they've already tried that didn't work — and why",
    "The trigger moment that makes them finally search for a product like this (e.g. 'Sunday evening, fridge empty, third week in a row')",
    "What they tell themselves before clicking 'Buy' on a digital product (their internal permission slip)"
  ],
  "contentStrategy": [
    "Platform: [Name] | Angle: [Specific content angle for this product, not just 'post about it'] | Format: [What the video/pin looks like] | Funnel: [Exact path from content to sale — e.g. 'Video → comment hook → DM with freebie → link to product page'] | Frequency: [How often]",
    "Platform: [Name] | Angle: [Different angle] | Format: [...] | Funnel: [...] | Frequency: [...]",
    "Platform: [Name] | Angle: [...] | Format: [...] | Funnel: [...] | Frequency: [...]"
  ],
  "launchStrategy": [
    "Pre-launch (3-5 days before): Specific action to build anticipation — what to post, what to say, what freebie or teaser to share",
    "Launch day: Exact sequence — what time to post, what the CTA is, how many posts across which platforms",
    "Days 2-7: How to sustain momentum without being repetitive or pushy — specific content ideas",
    "Week 2 onwards: The evergreen content system that keeps driving sales passively — what to create and where to direct people"
  ]
}`;


    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a digital product sales strategist who has helped creators sell PDF guides, Notion templates, and workbooks on TikTok, Instagram, Pinterest, and Etsy. You write copy that converts because you understand the specific buyer — their life situation, their trigger moments, and why they hesitate before buying. You write hooks that stop the scroll, CTAs that create action, and marketing strategies that explain the full content-to-sale funnel. You never use generic phrases like 'feeling overwhelmed' or 'achieve your goals'. You never invent statistics. Every recommendation is specific to the exact product and buyer. Return only valid JSON matching the exact structure requested. No markdown, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 5000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI product-sales-guide error:", err);
      return NextResponse.json(
        { error: "Failed to generate sales guide" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    let jsonText = content.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    }
    const parsed = JSON.parse(jsonText) as ProductSalesGuide;

    const guide: ProductSalesGuide = {
      productOverview: {
        productName: parsed.productOverview?.productName ?? productTitle,
        format: parsed.productOverview?.format ?? productType,
        targetCustomer: parsed.productOverview?.targetCustomer ?? "",
        transformation: parsed.productOverview?.transformation ?? productWhy,
      },
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      solutions: Array.isArray(parsed.solutions) ? parsed.solutions : [],
      keyBenefits: Array.isArray(parsed.keyBenefits) ? parsed.keyBenefits : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      hooks: Array.isArray(parsed.hooks)
        ? parsed.hooks.map((h: { text?: string; whyItWorks?: string; type?: string }) => ({
            text: h.text ?? "",
            whyItWorks: h.whyItWorks ?? "",
            ...(h.type ? { type: h.type } : {}),
          }))
        : [],
      ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [],
      pricingPsychology: Array.isArray(parsed.pricingPsychology) ? parsed.pricingPsychology : [],
      idealCustomerProfile: Array.isArray(parsed.idealCustomerProfile) ? parsed.idealCustomerProfile : [],
      contentStrategy: Array.isArray(parsed.contentStrategy) ? parsed.contentStrategy : [],
      launchStrategy: Array.isArray(parsed.launchStrategy) ? parsed.launchStrategy : [],
    };

    return NextResponse.json(guide);
  } catch (err) {
    console.error("Product sales guide error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate sales guide",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
