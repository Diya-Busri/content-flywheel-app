/**
 * AI-powered product intelligence breakdown for affiliate conversion.
 */

export type ProductBreakdown = {
  productName: string;
  productDescription: string;
  category: string;
  targetAudience: string;
  corePainPoints: string[];
  buyingObjections: string[];
  emotionalTriggers: string[];
  whyBuy: string[];
};

export type ProductBreakdownInput = {
  productLink?: string;
  productName?: string;
  productDescription?: string;
  productImageBase64?: string;
};

/**
 * Generate AI product breakdown from link, name, or image.
 */
export async function generateProductBreakdown(
  input: ProductBreakdownInput
): Promise<ProductBreakdown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const hasLink = Boolean(input.productLink?.trim());
  const hasName = Boolean(input.productName?.trim());
  const hasDescription = Boolean(input.productDescription?.trim());
  const hasImage = Boolean(input.productImageBase64?.trim());

  if (!hasLink && !hasName && !hasDescription && !hasImage) {
    throw new Error("Provide at least one: productLink, productName, productDescription, or productImage.");
  }

  const textInput = [
    hasLink && `Link: ${input.productLink!.trim()}`,
    hasName && `Product name: ${input.productName!.trim()}`,
    hasDescription && `Description: ${input.productDescription!.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const systemContent = `You are an expert TikTok Shop affiliate strategist. Analyze products to generate conversion-focused intelligence.

Return valid JSON only, no markdown, with this exact structure:
{
  "productName": "best-effort product name if not provided",
  "productDescription": "1-2 sentence summary of what the product is and does",
  "category": "e.g. Skincare, Fashion, Electronics",
  "targetAudience": "who would buy this, demographics and psychographics",
  "corePainPoints": ["pain 1", "pain 2", "pain 3"],
  "buyingObjections": ["objection 1", "objection 2"],
  "emotionalTriggers": ["trigger 1", "trigger 2", "trigger 3"],
  "whyBuy": ["reason 1", "reason 2", "reason 3"]
}

Be specific to THIS product—no generic answers.`;

  const userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = hasImage
    ? [
        { type: "text", text: `Analyze this product and generate the breakdown.\n\n${textInput || "Product image only—infer from visual."}` },
        { type: "image_url", image_url: { url: input.productImageBase64!.startsWith("data:") ? input.productImageBase64! : `data:image/jpeg;base64,${input.productImageBase64}` } },
      ]
    : textInput || "Generate product breakdown from the provided info.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // gpt-4o-mini: product breakdown, non-critical
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[product-breakdown] OpenAI error:", res.status, err);
    throw new Error("OpenAI request failed: " + res.status);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("OpenAI returned empty breakdown");

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  return {
    productName: String(parsed.productName ?? input.productName ?? "Product").trim(),
    productDescription: String(parsed.productDescription ?? input.productDescription ?? "").trim(),
    category: String(parsed.category ?? "General").trim(),
    targetAudience: String(parsed.targetAudience ?? "General consumers").trim(),
    corePainPoints: Array.isArray(parsed.corePainPoints)
      ? parsed.corePainPoints.map((p) => String(p).trim()).filter(Boolean)
      : [],
    buyingObjections: Array.isArray(parsed.buyingObjections)
      ? parsed.buyingObjections.map((o) => String(o).trim()).filter(Boolean)
      : [],
    emotionalTriggers: Array.isArray(parsed.emotionalTriggers)
      ? parsed.emotionalTriggers.map((t) => String(t).trim()).filter(Boolean)
      : [],
    whyBuy: Array.isArray(parsed.whyBuy)
      ? parsed.whyBuy.map((r) => String(r).trim()).filter(Boolean)
      : [],
  };
}
