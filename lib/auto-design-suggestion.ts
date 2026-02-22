/**
 * Server-side auto-design suggestion (OpenAI). Used by /api/auto-design and /api/products/[id]/apply-design.
 */
export type AutoDesignSuggestion = {
  primary: string;
  secondary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  pexelsKeyword: string;
  /** Overlay on cover/back so text is readable (hex). */
  overlayColor: string;
  /** 0–1. Higher = more opaque overlay. */
  overlayOpacity: number;
  /** Solid background for content pages (hex). */
  contentPageBackgroundColor: string;
};

function normalizeHex(color: string): string {
  const s = String(color).trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1] + s[1],
      g = s[2] + s[2],
      b = s[3] + s[3];
    return `#${r}${g}${b}`.toLowerCase();
  }
  return s.startsWith("#") ? s : `#${s}`;
}

export type AutoDesignInput = {
  title: string;
  niche: string;
  brandPrimary?: string;
  brandSecondary?: string;
};

export async function getAutoDesignSuggestion(
  input: AutoDesignInput
): Promise<AutoDesignSuggestion> {
  const { title, niche, brandPrimary, brandSecondary } = input;
  const useBrandColors = Boolean(
    brandPrimary?.trim() && brandSecondary?.trim()
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const prompt = `You are a digital product design expert. Given a product title and topic/niche, suggest a cohesive design for a digital product (ebook/guide).

Product title: ${title || "Untitled"}
Topic/niche: ${niche || "General"}

Return ONLY a valid JSON object (no markdown, no code fence) with exactly these keys:
- "primary": string, hex color for main text and headings (e.g. "#1a1a1a" or "#0f172a")
- "secondary": string, hex color for body text (e.g. "#475569" or "#64748b")
- "accent": string, hex color for subheadings and highlights (e.g. "#f97316" or "#0ea5e9")
- "headingFont": string, one CSS-safe font name for titles/headings (e.g. "Playfair Display", "Montserrat", "Georgia", "Inter")
- "bodyFont": string, one CSS-safe font name for body text (e.g. "Inter", "Open Sans", "Lato", "Source Sans 3")
- "pexelsKeyword": string, a single English search term for a cover/back background stock photo that fits the topic (e.g. "minimal office", "nature landscape", "abstract gradient", "coffee workspace")
- "overlayColor": string, hex color for the overlay on cover/back so title text is readable (e.g. "#000000" for dark overlay, "#ffffff" for light)
- "overlayOpacity": number, 0 to 1. Use 0.6-0.85 so the background image shows through but text stays readable
- "contentPageBackgroundColor": string, hex for content pages (e.g. "#ffffff", "#f8fafc", "#fefce8"). Keep neutral and readable

Keep colors readable and professional. Fonts must be common or Google Fonts names.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You respond only with a valid JSON object. No markdown, no explanation.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[auto-design-suggestion] OpenAI error:", response.status, err);
    throw new Error("Failed to generate design");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("No design suggestion returned");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  const overlayOpacityRaw = parsed.overlayOpacity;
  const overlayOpacity =
    typeof overlayOpacityRaw === "number" && overlayOpacityRaw >= 0 && overlayOpacityRaw <= 1
      ? overlayOpacityRaw
      : 0.75;
  return {
    primary: useBrandColors
      ? normalizeHex(brandPrimary!)
      : normalizeHex(String(parsed.primary ?? "#1a1a1a")),
    secondary: useBrandColors
      ? normalizeHex(brandSecondary!)
      : normalizeHex(String(parsed.secondary ?? "#475569")),
    accent: useBrandColors
      ? normalizeHex(brandPrimary!)
      : normalizeHex(String(parsed.accent ?? "#f97316")),
    headingFont: String(parsed.headingFont ?? "Inter").trim(),
    bodyFont: String(parsed.bodyFont ?? "Inter").trim(),
    pexelsKeyword: String(parsed.pexelsKeyword ?? "minimal abstract").trim(),
    overlayColor: normalizeHex(String(parsed.overlayColor ?? "#000000")),
    overlayOpacity,
    contentPageBackgroundColor: normalizeHex(
      String(parsed.contentPageBackgroundColor ?? "#ffffff")
    ),
  };
}
