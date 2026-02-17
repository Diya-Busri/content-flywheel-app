import { NextRequest, NextResponse } from "next/server";

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
  hooks: Array<{ text: string; whyItWorks: string }>;
  ctas: Array<{ text: string; whyItWorks: string }>;
  pricingPsychology: string[];
  idealCustomerProfile: string[];
  contentStrategy: string[];
  launchStrategy: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const productTitle = typeof body.productTitle === "string" ? body.productTitle.trim() : "";
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

    const prompt = `You are a masterclass instructor teaching a creator how to SELL their specific digital product. Generate a complete sales education guide tailored to this product. Be specific—use the exact product name, format, and price. Return ONLY valid JSON (no markdown).

PRODUCT:
- Name: "${productTitle}"
- Type/format: ${productType || "Digital product"}
- Price: ${productPrice || "Not specified"}
- What's included: ${productIncluded || ""}
- Why it sells: ${productWhy || ""}

AUDIENCE/CONTEXT:
- Niche: ${nicheName || "General"}
- Creator's goal: ${goal || "Sell the product"}

Return this exact JSON structure (use empty arrays if needed):

{
  "productOverview": {
    "productName": "exact product name",
    "format": "e.g. PDF + Guide, 90-day challenge",
    "targetCustomer": "who it's for (1-2 sentences)",
    "transformation": "main outcome/transformation (1 sentence, e.g. 'This 90-day challenge helps new parents save £3,000 for baby expenses without cutting essentials')"
  },
  "painPoints": ["pain 1", "pain 2", "pain 3", "pain 4", "pain 5", "pain 6", "pain 7"],
  "solutions": [
    {"pain": "exact pain point from list", "solution": "how the product solves it"},
    {"pain": "...", "solution": "..."}
  ],
  "keyBenefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4", "benefit 5", "benefit 6", "benefit 7", "benefit 8"],
  "objections": [
    {"objection": "common objection", "answer": "persuasive answer"},
    {"objection": "...", "answer": "..."}
  ],
  "hooks": [
    {"text": "hook text for first 3 seconds", "whyItWorks": "brief psychology/reason"},
    {"text": "...", "whyItWorks": "..."}
  ],
  "ctas": [
    {"text": "CTA text", "whyItWorks": "brief psychology"},
    {"text": "...", "whyItWorks": "..."}
  ],
  "pricingPsychology": [
    "Why this price point works (4-5 short bullets, include ROI if relevant)"
  ],
  "idealCustomerProfile": [
    "Who should buy (5-7 bullets: demographics, income, where they hang out, struggles)"
  ],
  "contentStrategy": [
    "Where to promote (4-6 bullets: TikTok, Instagram, Pinterest, groups with specific angle for THIS product)"
  ],
  "launchStrategy": [
    "How to release (3-5 bullets: pre-launch, launch day, post-launch)"
  ]
}

Rules:
- painPoints: 5-7 specific pains the target customer has
- solutions: match each pain with how THIS product solves it
- keyBenefits: 6-8 tangible benefits (include numbers/deliverables when possible)
- objections: 3-5 common objections with strong, specific answers (mention price ROI when relevant)
- hooks: 5-6 video hooks that reference the product/format/duration; whyItWorks in one short sentence
- ctas: 5-6 CTAs that are product-specific (e.g. "Start Day 1", "Join the challenge"); whyItWorks in one short sentence
- pricingPsychology: explain why this price works, impulse range, ROI
- idealCustomerProfile: demographics, income range, platforms, psychographics
- contentStrategy: platform + specific content angle for this product
- launchStrategy: pre-launch, launch day tactic, post-launch
- All content must be specific to "${productTitle}" and ${nicheName || "the niche"}, not generic.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-4o-mini: sales guide structure, not long-form content
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at teaching creators how to sell digital products. Return only valid JSON matching the exact structure requested. No markdown, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
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
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
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
