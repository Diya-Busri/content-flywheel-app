import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import { sanitizeAiStorySceneImagePrompt } from "@/lib/ai-story-character-style";

const SEED_WORD_TARGET = 40;

export type GenerateCharacterSeedContext = {
  /** Satisfying Build: single type. AI Story: comma-separated types. */
  characterTypesLine: string;
  /** Satisfying Build: what_building. AI Story: theme. */
  themeOrBuilding: string;
  /** Short label for the system prompt, e.g. "Satisfying Build" / "AI Story" */
  templateName: string;
  /** Optional extra tone (style, tone, build_style) */
  flavorLine?: string;
};

/**
 * One GPT-4o call: locked ~40-word visual character description for consistent image generation.
 */
export async function generateStoryCharacterSeed(
  apiKey: string,
  ctx: GenerateCharacterSeedContext
): Promise<string> {
  const types = ctx.characterTypesLine.trim();
  const context = ctx.themeOrBuilding.trim();
  if (!types && !context) return "";

  const systemPrompt = `You write locked visual character descriptions for AI image generation.

Output a JSON object with exactly one key "character_seed" whose value is a single string.

Rules for character_seed:
- EXACTLY ${SEED_WORD_TARGET} words (count the words; not 39, not 41).
- Describe only visual appearance: species/form, proportions, colors, materials, clothing or surface, facial features if any, art style cue — what must stay identical in every frame.
- Tie the look to the given character type(s) and the project context (build/theme).
- No dialogue, no scene action, no camera — only the character(s) as subjects.
- No text to appear in images.

Output only valid JSON, no markdown.`;

  const userPrompt = `Template: ${ctx.templateName}
Character type(s): ${types || "(infer from context)"}
Project context: ${context || "(unspecified)"}
${ctx.flavorLine?.trim() ? `Additional tone: ${ctx.flavorLine.trim()}` : ""}

Write the ${SEED_WORD_TARGET}-word character_seed now.`;

  const response = await fetchOpenAIWithRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.55,
      }),
    }
  );

  if (!response.ok) return "";

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") return "";

  try {
    const parsed = JSON.parse(content) as { character_seed?: unknown };
    const raw =
      typeof parsed.character_seed === "string"
        ? parsed.character_seed.trim()
        : "";
    if (!raw) return "";
    return sanitizeAiStorySceneImagePrompt(raw);
  } catch {
    return "";
  }
}

export function prependCharacterSeedToSceneImagePrompts<
  T extends { imagePrompt: string },
>(scenes: T[], characterSeed: string): T[] {
  const seed = characterSeed.trim();
  if (!seed) return scenes;
  const prefix = `${seed}\n\n`;
  return scenes.map((s) => ({
    ...s,
    imagePrompt: sanitizeAiStorySceneImagePrompt(`${prefix}${s.imagePrompt.trim()}`),
  }));
}
