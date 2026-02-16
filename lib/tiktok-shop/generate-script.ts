import type { VideoStyle, HookStyle, ScriptTone, ScriptWithScenes } from "./types";

export type GenerateScriptOptions = {
  productName: string;
  productDescription: string;
  videoStyle: VideoStyle;
  platform: string;
  /** Target video length in seconds (15–60). Influences script length. */
  targetDurationSec?: number;
  /** Hook style for conversion mode */
  hookStyle?: HookStyle;
  /** Tone of the script */
  tone?: ScriptTone;
  /** Regenerate only this section (hook, pain, solution, proof, cta) */
  regenerateSection?: "hook" | "pain" | "solution" | "proof" | "cta";
  /** Existing script scenes when regenerating one section */
  existingScenes?: ScriptWithScenes["scenes"];
};

/**
 * Generate short, punchy, conversion-style TikTok Shop UGC script.
 * 20–25 seconds, max 10 words per sentence, emotional hook, urgency, clear CTA.
 */
const HOOK_STYLE_PROMPTS: Record<string, string> = {
  problem: "HOOK: Start with the problem or pain. Make them feel it.",
  story: "HOOK: Open with a brief relatable story or scenario.",
  controversial: "HOOK: Take a stance. Bold opinion that gets attention.",
  "before-after": "HOOK: Tease the transformation or before/after.",
  comparison: "HOOK: Compare to alternatives or expectations.",
  "tiktok-made-me-buy": "HOOK: 'TikTok made me buy it' energy—FOMO, viral, obsessed.",
  question: "HOOK: Start with a compelling question.",
  stat: "HOOK: Lead with a surprising stat or number.",
};

const TONE_PROMPTS: Record<string, string> = {
  "soft-aesthetic": "Tone: Soft, aesthetic, cozy, calming. Like a lifestyle creator.",
  aggressive: "Tone: Direct, urgent, aggressive sales. Stop-scroll energy.",
  luxury: "Tone: Premium, aspirational, sophisticated. Worth the splurge.",
  budget: "Tone: Value-focused, affordable, smart buy. Great for the price.",
  "ugc-style": "Tone: Raw, authentic UGC. Like a friend sharing a find.",
};

export async function generateVideoScript(options: GenerateScriptOptions): Promise<ScriptWithScenes> {
  const { productName, productDescription, videoStyle, platform, targetDurationSec, hookStyle, tone, regenerateSection, existingScenes } = options;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const description = (productDescription ?? "").trim();
  if (!description) {
    throw new Error("Product description is required so the script aligns with the product.");
  }

  console.log("[generate-script] Generating:", { productName: productName.slice(0, 30), videoStyle, platform, targetDurationSec });

  const durationSec =
    targetDurationSec != null && targetDurationSec >= 15 && targetDurationSec <= 60
      ? targetDurationSec
      : 22;
  const wordsMin = Math.round((durationSec - 2) * 2.5);
  const wordsMax = Math.round((durationSec + 2) * 2.8);

  const hookPrompt = hookStyle && HOOK_STYLE_PROMPTS[hookStyle] ? HOOK_STYLE_PROMPTS[hookStyle] : "";
  const tonePrompt = tone && TONE_PROMPTS[tone] ? TONE_PROMPTS[tone] : "";
  const modePrompts = [hookPrompt, tonePrompt].filter(Boolean).join("\n");

  const systemPrompt = `You write viral TikTok Shop UGC scripts for real product ads. Natural, punchy, conversion-focused. The product description is the single source of truth: pain points, solution, and why it works must come directly from it. The script must feel like an actual product advertisement for THIS product only—nothing generic or fake.
${modePrompts ? `\nMODE:\n${modePrompts}\n` : ""}
HARD RULES:
- Total script length: ${durationSec - 2}–${durationSec + 2} seconds when spoken (roughly ${wordsMin}–${wordsMax} words). Fill the time—no short script that leaves dead air.
- Every sentence: MAX 10 words. No run-on sentences.
- No generic fluff. Every line must hook, prove, or convert. Sound natural, not scripted.
- HOOK: First line must grab attention (curiosity, FOMO, desire, frustration). Strong and specific to this product.
- PAIN: The real problem or desire from the product description—not generic.
- SOLUTION: How THIS product fixes it (from the description). Include how to use/apply where relevant (e.g. "Spray on pulse points", "Apply after shower") so it feels like someone is using it.
- PROOF: 2–4 short proof points from the product (ingredients, duration, results, price). Each max 5–7 words. Why it works goes here or in solution.
- CTA: End with a clear, direct call to action (link in bio, get it below, shop the link). Tell them exactly what to do.
- Include urgency (limited, selling out, price won’t last, etc.) where it fits.

ALIGNMENT WITH PRODUCT DESCRIPTION:
- pain: Must be the actual problem or desire this product solves (from the description).
- solution: How THIS product fixes it—specific to the product, not generic. Reference use/application when the description mentions it.
- proof_points: From the product (ingredients, duration, results, price). Why it works: weave into solution or proof.

BANNED PHRASES (never use):
- "I just got my hands on"
- "carefully curated"
- "high quality"
- "specifically chosen"
- "must-have" without a concrete reason
- "you need this in your life" (generic)

REQUIRED OUTPUT:
- hook: One punchy line. Emotional hook. Max 10 words.
- pain: One line. The real problem or desire this product addresses. Max 10 words.
- solution: One short line. Why this product fixes it (specific to product). Max 10 words.
- proof_points: Array of 2–4 short proof points. Each max 5–7 words. Examples: "Lasts 24 hours", "No parabens", "Under $15", "Viral on TikTok".
- cta: One line. Clear CTA. Do not include "Buy now on TikTok Shop" (we add it). Max 10 words.

Output valid JSON only, no markdown, with this exact structure:
{
  "fullScript": "The complete voiceover. ${durationSec - 2}–${durationSec + 2} seconds when read. Every sentence max 10 words. Aligned with THIS product only: pain, solution, why it works, application/use, clear CTA. Natural product ad tone. No stage directions.",
  "scenes": {
    "hook": "",
    "pain": "",
    "solution": "",
    "proof_points": [],
    "cta": ""
  }
}`;

  const isRegenerate = Boolean(regenerateSection && existingScenes);
  let userPrompt: string;

  if (isRegenerate) {
    const section = regenerateSection!;
    const existing = existingScenes!;
    userPrompt = `Product: ${productName}\n\nProduct description:\n${description}\n\nRegenerate ONLY the "${section}" section. Keep the rest. Existing scenes: hook="${existing.hook}", pain="${existing.pain}", solution="${existing.solution}", proof_points=${JSON.stringify(existing.proof_points ?? [])}, cta="${existing.cta}". Output valid JSON with the same structure but with a new value only for "scenes.${section === "proof" ? "proof_points" : section}". For fullScript, reconstruct the complete script by replacing the ${section} part with the new one.`;
  } else {
    userPrompt = `Product: ${productName}\n\nProduct description (use for pain points, solution, why it works, how to use/apply):\n${description}\n\nWrite a natural, punchy UGC script that fills ${durationSec} seconds when spoken (roughly ${wordsMin}–${wordsMax} words). Script must match THIS product only—like a real product ad. Strong hook. Real pain point and solution from the description. Proof points from the product. Clear CTA. Natural tone, not fake. No banned phrases. Output the JSON.`;
  }

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
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[generate-script] OpenAI error:", res.status, err);
    throw new Error("OpenAI request failed: " + res.status);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI returned empty script");
  }

  const parsed = parseScriptJson(raw);
  if (!parsed.fullScript || !parsed.scenes?.hook || !parsed.scenes?.pain || !parsed.scenes?.solution || !parsed.scenes?.cta) {
    console.error("[generate-script] Invalid JSON structure:", raw.slice(0, 200));
    throw new Error("OpenAI returned invalid script structure");
  }

  console.log("[generate-script] Done, fullScript length:", parsed.fullScript.length, "proof_points:", parsed.scenes.proof_points?.length ?? 0);
  return parsed;
}

function parseScriptJson(raw: string): ScriptWithScenes {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as {
    fullScript?: string;
    scenes?: { hook?: string; pain?: string; solution?: string; proof_points?: string[]; cta?: string };
  };
  const proofPoints = parsed.scenes?.proof_points;
  return {
    fullScript: String(parsed.fullScript ?? "").trim(),
    scenes: {
      hook: String(parsed.scenes?.hook ?? "").trim(),
      pain: String(parsed.scenes?.pain ?? "").trim(),
      solution: String(parsed.scenes?.solution ?? "").trim(),
      proof_points: Array.isArray(proofPoints) ? proofPoints.map((p) => String(p).trim()).filter(Boolean) : undefined,
      cta: String(parsed.scenes?.cta ?? "").trim(),
    },
  };
}
