import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";

export const dynamic = "force-dynamic";

export type ThumbnailTemplate = "finance" | "gaming" | "vlog" | "education";

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
    const template = TEMPLATES.some((t) => t.value === body.template) ? body.template : "vlog";

    if (!topic) return NextResponse.json({ error: "Video title/topic is required." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI is not configured. Add OPENAI_API_KEY." }, { status: 503 });

    const prompt = `Generate 3 thumbnail concepts for video topic: "${topic}". Niche: ${template}. For each concept return: titleSuggestion (3-6 words for overlay), promptForImage (DALL-E prompt for background ONLY, no text), ctrPrediction (e.g. "High (8-12%)"), suggestedColors (array of hex codes), layout (short description). Return ONLY a JSON array of 3 objects with keys titleSuggestion, promptForImage, ctrPrediction, suggestedColors, layout. No markdown.`;

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

    return NextResponse.json({ concepts, topic, template });
  } catch (err) {
    console.error("[thumbnails/concepts]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
