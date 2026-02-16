/**
 * UGC Lab — AI-suggested ranking order.
 * Analyzes products and suggests optimal ranking. Does not hardcode order.
 */

export type ProductForRanking = {
  id: string;
  productName: string;
  productLink?: string | null;
  role: string;
};

/**
 * Call AI to suggest ranking order. Returns product IDs in suggested order (best first).
 * Uses stored product names/links for context. Order is not hardcoded.
 */
export async function suggestRankingOrder(
  products: ProductForRanking[],
  productContext?: string
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || products.length < 2) {
    return products.map((p) => p.id);
  }

  const productList = products
    .map((p, i) => `${i + 1}. [${p.id}] ${p.productName}${p.productLink ? ` (${p.productLink})` : ""}`)
    .join("\n");

  const systemPrompt = `You suggest an optimal ranking order for a "Top N" or "Best of" UGC video.
Given a list of products, return their IDs in order from BEST/RECOMMENDED (first) to LEAST (last).
Consider: quality, value, appeal, and what would work best for a conversion-focused ranking video.
Output JSON only: { "productIds": ["uuid1", "uuid2", ...] } in your suggested order.
Use the exact product IDs provided. Do not invent IDs.`;

  const userPrompt = `Products to rank:
${productList}
${productContext?.trim() ? `\nAdditional context: ${productContext}\n` : ""}
Return JSON: { "productIds": ["id1", "id2", ...] } in suggested order (best first).`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    console.error("[suggest-ranking] OpenAI error:", res.status, await res.text());
    return products.map((p) => p.id);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return products.map((p) => p.id);

  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { productIds?: string[] };
    const ids = parsed.productIds;
    if (!Array.isArray(ids) || ids.length === 0) return products.map((p) => p.id);

    const validIds = new Set(products.map((p) => p.id));
    const ordered = ids.filter((id) => validIds.has(id));
    const missing = products.filter((p) => !ids.includes(p.id)).map((p) => p.id);
    return [...ordered, ...missing];
  } catch {
    return products.map((p) => p.id);
  }
}
