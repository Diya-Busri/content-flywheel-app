import type { VideoStyle } from "./types";

export type GenerateScriptOptions = {
  productName: string;
  productDescription: string;
  videoStyle: VideoStyle;
  platform: string;
};

/**
 * Generate a short video script using OpenAI.
 * TikTok = short and punchy; YouTube = slightly longer; Instagram = similar to TikTok.
 */
export async function generateVideoScript(options: GenerateScriptOptions): Promise<string> {
  const { productName, productDescription, videoStyle, platform } = options;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  console.log("[generate-script] Generating:", { productName: productName.slice(0, 30), videoStyle, platform });

  const styleInstructions: Record<VideoStyle, string> = {
    unboxing: "Unboxing style: excitement, first look, key features as you reveal. Hook in first 2 seconds.",
    demo: "Demo style: show how to use the product, benefits, clear steps. Focus on value.",
    "before-after": "Before-after style: problem first, then solution with the product. Strong contrast.",
  };

  const platformInstructions: Record<string, string> = {
    tiktok: "Keep it very short (15–45 seconds when spoken). Punchy hooks, fast pace, trending tone.",
    instagram: "Short and visual. 15–60 seconds. Reels-style, catchy and shareable.",
    youtube: "Can be 30–90 seconds. Slightly more explanatory but still engaging.",
  };

  const systemPrompt = `You are a viral short-form video scriptwriter. Write a script that will be read as voiceover.
${styleInstructions[videoStyle]}
${platformInstructions[platform] ?? platformInstructions.tiktok}
Output ONLY the script text, no stage directions or labels. 2–6 short paragraphs max.`;

  const userPrompt = `Product: ${productName}\nDescription: ${productDescription}\nWrite the voiceover script.`;

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
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[generate-script] OpenAI error:", res.status, err);
    throw new Error("OpenAI request failed: " + res.status);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) {
    throw new Error("OpenAI returned empty script");
  }

  console.log("[generate-script] Done, length:", script.length);
  return script;
}
