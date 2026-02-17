import type { ProductData, ScriptResult, StructureBlueprint } from "./types";

const RULES = [
  "Exactly 5 scenes. Total duration 20-45 seconds.",
  "Scene 1 (hook): durationSec 2-4, requiresProductOverlay = true.",
  "Scene 3 (demo): durationSec 6-12, requiresProductOverlay = true.",
  "Scene 4 (result): requiresBeforeAfter = true only if before/after assets exist.",
  "Scene 5 (cta): strong CTA with TikTok Shop wording.",
  "voiceLines short and conversational. onScreenText punchy, max ~8 words.",
  "Mention product name naturally 1-2 times. Sum of durationSec 20-45.",
].join(" ");

export async function generateTikTokShopScript(
  productData: ProductData,
  structureBlueprint?: StructureBlueprint | null
): Promise<ScriptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("OPENAI_API_KEY is not set");

  const hasBeforeAfter =
    Boolean(productData.beforeImageUrl) && Boolean(productData.afterImageUrl);

  const structureHint = structureBlueprint
    ? `\nUse this structural pattern only (do NOT copy script or visuals): hookType=${structureBlueprint.hookType}, pacing=${structureBlueprint.pacing}, ctaStyle=${structureBlueprint.ctaStyle}.${structureBlueprint.sceneDurationsHint?.length ? ` Prefer scene durations (seconds): ${structureBlueprint.sceneDurationsHint.join(", ")}.` : ""}`
    : "";

  const prompt = `Product: ${productData.name}
${productData.description ? `Description: ${productData.description}` : ""}
${productData.keyBenefits?.length ? `Key benefits: ${productData.keyBenefits.join(", ")}` : ""}
${productData.price ? `Price: ${productData.price}` : ""}
${productData.claim ? `Claim: ${productData.claim}` : ""}
${productData.ctaText ? `CTA: ${productData.ctaText}` : ""}
${hasBeforeAfter ? "We have before/after images." : "No before/after."}
${structureHint}

Generate script as JSON only (no markdown). fullNarration string + scenes array. Each scene: sceneIndex, sceneType (hook|problem|demo|result|cta), durationSec, voiceLine, onScreenText, requiresProductOverlay, requiresBeforeAfter. Rules: ${RULES}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-4o-mini: script/scene structure, not product long-form content
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You output STRICT JSON only. No markdown, no code fences. fullNarration (string) and scenes (array of 5). Each scene: sceneIndex, sceneType, durationSec, voiceLine, onScreenText, requiresProductOverlay, requiresBeforeAfter.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!res.ok) {
      console.error("[tiktokshop/script] OpenAI error:", res.status, text.slice(0, 200));
      throw new Error("OpenAI script failed: " + res.status);
    }

    const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("OpenAI no script content");

    const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const result = JSON.parse(cleaned) as ScriptResult;
    if (!result.fullNarration || !Array.isArray(result.scenes) || result.scenes.length !== 5) {
      throw new Error("Script must have fullNarration and 5 scenes");
    }
    const totalSec = result.scenes.reduce((s, sc) => s + (sc.durationSec ?? 0), 0);
    if (totalSec < 20 || totalSec > 45) throw new Error("Total duration must be 20-45s, got " + totalSec);
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError")
      throw new Error("OpenAI script request timed out");
    throw err;
  }
}
