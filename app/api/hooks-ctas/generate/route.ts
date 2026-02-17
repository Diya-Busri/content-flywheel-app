import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const productTitle = typeof body.productTitle === "string" ? body.productTitle.trim() : "";
    const productType = typeof body.productType === "string" ? body.productType : "";
    const productIncluded = typeof body.productIncluded === "string" ? body.productIncluded : "";
    const productWhy = typeof body.productWhy === "string" ? body.productWhy : "";
    const productPrice = typeof body.productPrice === "string" ? body.productPrice : "";
    const nicheName = typeof body.nicheName === "string" ? body.nicheName : "";

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

    const context = [
      `Product: "${productTitle}"`,
      productType ? `Type: ${productType}` : "",
      productPrice ? `Price: ${productPrice}` : "",
      productIncluded ? `What's included: ${productIncluded}` : "",
      productWhy ? `Why it sells: ${productWhy}` : "",
      nicheName ? `Niche/audience: ${nicheName}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Generate video HOOKS and CTAs tailored to this exact digital product. Do NOT use generic phrases.

PRODUCT CONTEXT:
${context}

RULES FOR HOOKS (generate 5-6):
- Reference the SPECIFIC product name or format (e.g. "90-day challenge", "savings challenge", "this tracker").
- Mention duration if relevant (7-day, 30-day, 90-day).
- Mention the key benefit or outcome (saving money, getting organized, completing the challenge).
- Mention specific deliverables if they help (daily check-ins, Day 1, checklist).
- First 3 seconds style: curiosity, outcome, or social proof.
- Do NOT use generic hooks like "Link in bio" or "Comment BUDGET".

RULES FOR CTAs (generate 5-6):
- Reference the product action: "Start the challenge", "Download Day 1", "Get your checklist", "Join the 90-day journey".
- Be product-specific: e.g. "Start your 90-day savings challenge today" not "Download now".
- Include one soft CTA if relevant (e.g. "Save this for when you're ready").
- Do NOT use generic CTAs like "Link in bio for the free template" or "Comment BUDGET and I'll send it".

Return ONLY valid JSON (no markdown):
{
  "hooks": ["hook 1", "hook 2", "hook 3", "hook 4", "hook 5"],
  "ctas": ["cta 1", "cta 2", "cta 3", "cta 4", "cta 5"]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-4o-mini: hooks and CTAs, non-critical
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at writing viral video hooks and CTAs for digital products. Return only valid JSON with keys 'hooks' and 'ctas', each an array of strings.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI hooks-ctas error:", err);
      return NextResponse.json(
        { error: "Failed to generate hooks and CTAs" },
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
    const parsed = JSON.parse(jsonText) as { hooks?: string[]; ctas?: string[] };
    const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 6) : [];
    const ctas = Array.isArray(parsed.ctas) ? parsed.ctas.slice(0, 6) : [];

    return NextResponse.json({ hooks, ctas });
  } catch (err) {
    console.error("Hooks/CTAs generation error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate hooks and CTAs",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
