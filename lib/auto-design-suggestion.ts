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
  /** Product format so each type gets a unique design: ebook, workbook, planner, journal, checklist, course, notion, spreadsheet, etc. */
  format?: string;
  brandPrimary?: string;
  brandSecondary?: string;
};

export async function getAutoDesignSuggestion(
  input: AutoDesignInput
): Promise<AutoDesignSuggestion> {
  const { title, niche, format, brandPrimary, brandSecondary } = input;
  const useBrandColors = Boolean(
    brandPrimary?.trim() && brandSecondary?.trim()
  );
  const productFormat = (format ?? "ebook").toLowerCase().trim();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const formatPexelsExamples: Record<string, string> = {
    ebook: "morning light bokeh",
    workbook: "soft gradient pastel",
    planner: "clean desk minimal",
    journal: "open notebook flat lay",
    checklist: "soft pastel paper",
    course: "soft abstract blur",
    notion: "minimal workspace soft",
    spreadsheet: "soft blue gradient",
  };
  const suggestedKeyword =
    formatPexelsExamples[productFormat] ?? "soft abstract minimal";

  const prompt = `You are a digital product design expert. Suggest a UNIQUE design for THIS product type. Each format (Ebook, Workbook, Planner, Journal, etc.) must look different.

Product title: ${title || "Untitled"}
Topic/niche: ${niche || "General"}
Product format: ${productFormat}

Choose a distinct style and colour palette that fits this format. Ebook = elegant/readable; Workbook = inviting/activity feel; Planner = clean/organised; Journal = calm/reflective. Use different fonts and colours per format.

Return ONLY a valid JSON object (no markdown, no code fence) with exactly these keys:

- "primary": string, hex for main text/headings. Contrast with overlay: dark overlay → light text (#ffffff, #f8fafc); light overlay → dark text (#1a1a1a).
- "secondary": string, hex for body text. Same contrast rule.
- "accent": string, hex for subheadings/highlights.
- "headingFont": string, one CSS-safe font (e.g. Playfair Display, Montserrat, Georgia, Inter). Vary by format.
- "bodyFont": string, one CSS-safe font (e.g. Inter, Open Sans, Lato). Vary by format.
- "pexelsKeyword": string, ONE search term for a CLEAN, SOFT cover photo. Use ONLY terms like these (no architecture, no buildings, no stripes):
  - Personal development / general: "morning light bokeh", "soft bokeh light"
  - Journal: "open notebook flat lay", "journal flat lay soft"
  - Planner: "clean desk minimal", "minimal desk pastel"
  - Workbook: "soft gradient pastel", "pastel gradient soft"
  - Ebook / other: "soft abstract minimal", "blurred nature soft", "soft gradient"
  NEVER use: architecture, building, office, stripes, geometric pattern, wood, fabric, brick, concrete, or any term that could return busy or striped images.
- "overlayColor": string, SOLID hex only (#000000 or #1a1a2e for dark; #ffffff or #f8fafc for light). No patterns.
- "overlayOpacity": number, 0.35 to 0.6. Prefer 0.45-0.55.
- "contentPageBackgroundColor": string, hex for content pages (#ffffff, #f8fafc, etc.).

For this format ("${productFormat}") a good pexelsKeyword example is: "${suggestedKeyword}". You may use that or a similar soft/minimal term. Never use architecture or buildings.`;


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
  const overlayOpacityUnclamped =
    typeof overlayOpacityRaw === "number" && overlayOpacityRaw >= 0 && overlayOpacityRaw <= 1
      ? overlayOpacityRaw
      : 0.5;
  const overlayOpacity = Math.min(0.6, overlayOpacityUnclamped);

  const rawKeyword = String(parsed.pexelsKeyword ?? suggestedKeyword).trim().toLowerCase();
  const badKeyword =
    rawKeyword === "" ||
    /\b(stripe|striped|pattern|texture|geometric|busy|wood|fabric|noise|architecture|building|buildings|office|brick|concrete|grid|lines)\b/.test(
      rawKeyword
    );
  const pexelsKeyword = badKeyword ? suggestedKeyword : rawKeyword;

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
    pexelsKeyword: pexelsKeyword || "soft abstract minimal",
    overlayColor: normalizeHex(String(parsed.overlayColor ?? "#000000")),
    overlayOpacity,
    contentPageBackgroundColor: normalizeHex(
      String(parsed.contentPageBackgroundColor ?? "#ffffff")
    ),
  };
}
