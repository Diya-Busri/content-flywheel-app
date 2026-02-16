import type { ProductData, TikTokScriptResult } from "./types";

const OPENAI_SYSTEM = `You are a TikTok Shop video script writer. Output STRICT JSON only, no markdown, no explanation.

Return this exact structure:
{
  "fullNarration": "Complete voiceover text for TTS, one continuous string.",
  "scenes": [
    {
      "sceneIndex": 1,
      "sceneType": "hook" | "problem" | "demo" | "result" | "cta",
      "voiceLine": "Spoken line for this scene",
      "onScreenText": "Text overlay / caption",
      "requiresProductShot": true | false,
      "requiresBeforeAfter": true | false
    }
  ]
}

RULES (must follow):
- Scene 1: Must show product immediately. sceneType "hook", requiresProductShot true.
- Scene 3: Must demonstrate product usage. sceneType "demo", requiresProductShot true.
- Scene 4: Must show transformation. sceneType "result", requiresBeforeAfter true.
- Scene 5: Strong CTA. sceneType "cta", onScreenText must be a clear call-to-action (e.g. "Shop now", "Link in bio").
- Use exactly 5 scenes. Fast pacing. Vertical 9:16 mindset.
- fullNarration = concatenation of all voiceLine content, natural flow for TTS.
- Return only valid JSON.`;

export async function generateTikTokShopScript(
  productData: ProductData
): Promise<TikTokScriptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment.");
  }

  const prompt = `Product: ${productData.name}
${productData.description ? `Description: ${productData.description}` : ""}

Generate the TikTok Shop demo script as JSON with fullNarration and 5 scenes following the rules.`;

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
      temperature: 0.6,
      max_tokens: 2000,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[tiktok-shop-demo] OpenAI error:", res.status, text);
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

  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("OpenAI script content is not valid JSON");
  }

  const result = parsed as TikTokScriptResult;
  if (!result.fullNarration || !Array.isArray(result.scenes)) {
    throw new Error("OpenAI script missing fullNarration or scenes array");
  }

  return result;
}
