import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type ThumbnailTemplate = string;
type ThumbnailStyle = "auto" | "viral_stickman" | "viral_realistic";

export type ThumbnailConcept = {
  id: string;
  titleSuggestion: string;
  promptForImage: string;
  ctrPrediction: string;
  suggestedColors: string[];
  layout: string;
};

const TEMPLATES = [
  { value: "finance" as const, label: "Finance" },
  { value: "gaming" as const, label: "Gaming" },
  { value: "vlog" as const, label: "Vlog" },
  { value: "education" as const, label: "Education" },
];

type OpenAIConcept = {
  titleSuggestion?: string;
  promptForImage?: string;
  ctrPrediction?: string;
  suggestedColors?: string[];
  layout?: string;
};

function mapConcept(raw: OpenAIConcept, index: number): ThumbnailConcept {
  return {
    id: `concept-${Date.now()}-${index}`,
    titleSuggestion: typeof raw.titleSuggestion === "string" && raw.titleSuggestion.trim() ? raw.titleSuggestion.trim() : "Video title",
    promptForImage: typeof raw.promptForImage === "string" && raw.promptForImage.trim() ? raw.promptForImage.trim() : "Professional thumbnail background, no text",
    ctrPrediction: typeof raw.ctrPrediction === "string" && raw.ctrPrediction.trim() ? raw.ctrPrediction.trim() : "Medium (4-8%)",
    suggestedColors: Array.isArray(raw.suggestedColors) ? raw.suggestedColors.filter((c): c is string => typeof c === "string").slice(0, 5) : [],
    layout: typeof raw.layout === "string" && raw.layout.trim() ? raw.layout.trim() : "Title centered",
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const template =
      typeof body.template === "string" && body.template.trim()
        ? body.template.trim()
        : "vlog";
    const style: ThumbnailStyle =
      body.style === "viral_stickman" || body.style === "viral_realistic" ? body.style : "auto";

    if (!topic) return NextResponse.json({ error: "Video title/topic is required." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI is not configured. Add OPENAI_API_KEY." }, { status: 503 });

    const styleRules =
      style === "viral_stickman"
        ? `STYLE MODE: Viral Stickman whiteboard thumbnail.\n` +
          `- Subject must clearly be a polished stickman mascot illustration with bold readable silhouette.\n` +
          `- Use premium digital thumbnail style: depth, contrast, dramatic focal framing.\n` +
          `- Strong emotional cue: shocked, confident, or breakthrough moment.\n` +
          `- Keep composition bold and readable at small size.\n` +
          `- Each of the 3 concepts MUST be a different strategy: (1) presenter explain, (2) split comparison, (3) breakthrough action.\n` +
          `- titleSuggestion must be 2-4 words, ALL CAPS, punchy hook language, no weak/generic wording.\n`
        : style === "viral_realistic"
          ? `STYLE MODE: Viral realistic YouTube thumbnail.\n` +
            `- Cinematic lighting, high contrast, one clear focal subject.\n` +
            `- Keep dramatic but believable scene design with clean background separation.\n`
          : "";

    const imageRules =
      style === "viral_stickman"
        ? `IMPORTANT visual rules for promptForImage:\n` +
          `- Must be premium stickman mascot style (not rough scribble, not generic icon).\n` +
          `- One clear focal action with bold framing and depth that reads at small size.\n` +
          `- Strong emotion via pose/body language and topic-related props.\n` +
          `- Avoid flat low-detail sketch look and avoid clutter.\n` +
          `- No text, letters, logos, or watermarks in the image itself.\n`
        : `IMPORTANT visual rules for promptForImage:\n` +
          `- Must be realistic and thumbnail-friendly (not abstract, not chaotic art).\n` +
          `- One clear focal subject, strong contrast, clean composition, cinematic lighting.\n` +
          `- Match the topic context directly.\n` +
          `- Avoid surreal collages, random icon explosions, and unreadable clutter.\n` +
          `- No text, letters, logos, or watermarks in the image itself.\n` +
          `- Include camera framing and emotion cue (e.g. close-up, medium shot, confident / shocked expression).\n`;

    const prompt =
      `Generate 3 YouTube thumbnail concepts for video topic: "${topic}". Niche: ${template}.\n` +
      (styleRules ? `${styleRules}\n` : "") +
      `For each concept return:\n` +
      `- titleSuggestion (2-4 words for overlay in ALL CAPS)\n` +
      `- promptForImage (DALL-E prompt for image background ONLY, no text)\n` +
      `- ctrPrediction (e.g. "High (8-12%)")\n` +
      `- suggestedColors (array of hex codes)\n` +
      `- layout (short description)\n\n` +
      (style === "viral_stickman"
        ? `For stickman mode, titleSuggestion must feel like a stop-scroll hook (examples: "FACELESS WINS", "DON'T GO PERSONAL", "ANONYMITY ADVANTAGE"). Avoid generic titles like "brand secrets".\n\n`
        : "") +
      `${imageRules}\n` +
      `Return ONLY a JSON array of 3 objects with keys titleSuggestion, promptForImage, ctrPrediction, suggestedColors, layout. No markdown.`;

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Return only a valid JSON array. No markdown." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 1500,
        }),
      },
      { onRetry: () => {} }
    );

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "High demand. Try again." }, { status: 429 });
      return NextResponse.json({ error: "AI request failed." }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    let jsonText = content.trim();
    if (jsonText.startsWith("```")) jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = jsonText.match(/\[[\s\S]*\]/);
    const rawConcepts: OpenAIConcept[] = match ? JSON.parse(match[0]) : [];
    const concepts = rawConcepts.slice(0, 3).map(mapConcept);

    return NextResponse.json({ concepts, topic, template, style });
  } catch (err) {
    console.error("[thumbnails/concepts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
