import type { ProductData, StructuredScriptResult } from "./types";

const OPENAI_SYSTEM = `You are a video script writer for short-form product videos (TikTok, Reels, Shorts).
Given product data, output a structured script as JSON with:
- fullNarration: string (complete voiceover text, can be used for TTS)
- scenes: array of {
  sceneIndex: number (1-based),
  visualDescription: string (what to show on screen),
  voiceLine: string (spoken line for this scene),
  onScreenText: string (text overlay, hook or key phrase),
  requiresProductShot: boolean (true if this scene must show the product image/mockup)
}
Keep scenes short (3-7 scenes). Make voiceLine concise. Set requiresProductShot true for at least one scene that showcases the product. Return only valid JSON, no markdown.`;

export async function generateStructuredScript(
  productData: ProductData
): Promise<StructuredScriptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment.");
  }

  const prompt = `Product: ${productData.name}
${productData.description ? `Description: ${productData.description}` : ""}
${productData.imageUrl ? `(We have a product image to use where needed)` : ""}

Generate the script JSON with fullNarration and scenes.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: OPENAI_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[video-pipeline] OpenAI error:", res.status, text);
    throw new Error(`OpenAI script generation failed: ${res.status}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const content = (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
    ?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI did not return script content");
  }

  let parsed: unknown;
  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("OpenAI script content is not valid JSON");
  }

  const result = parsed as StructuredScriptResult;
  if (!result.fullNarration || !Array.isArray(result.scenes)) {
    throw new Error("OpenAI script missing fullNarration or scenes array");
  }

  return result;
}
