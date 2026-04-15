/**
 * Server-side auto-design suggestion (OpenAI). Used by /api/auto-design and /api/products/[id]/apply-design.
 */

/** Banned Pexels keywords — never use for cover. Only abstract, bokeh, gradient, or nature landscape. */
export const BANNED_PEXELS_KEYWORDS = [
  "bird",
  "animal",
  "cat",
  "dog",
  "wildlife",
  "architecture",
  "building",
  "door",
  "corridor",
  "hallway",
  "room",
  "interior",
  "wall",
  "entrance",
] as const;

/**
 * Safe cover keywords — single words or short phrases with thousands of Pexels results.
 * Strictly abstract/nature/texture — no people, animals, buildings, interiors.
 */
const SAFE_COVER_KEYWORDS_ALL = [
  "abstract",
  "gradient",
  "bokeh",
  "texture",
  "forest",
  "ocean",
  "mountains",
  "clouds",
  "flowers",
  "sunset",
] as const;

/** Guaranteed fallback keywords tried in order when the primary query returns nothing. */
export const PEXELS_FALLBACK_KEYWORDS = ["abstract", "gradient", "bokeh", "texture"] as const;

const DEFAULT_SAFE_KEYWORD = SAFE_COVER_KEYWORDS_ALL[0];

/**
 * Return a random safe Pexels keyword for cover backgrounds (used when preference is "random").
 */
export function getRandomCoverKeyword(): string {
  return SAFE_COVER_KEYWORDS_ALL[Math.floor(Math.random() * SAFE_COVER_KEYWORDS_ALL.length)];
}

/**
 * Return one of the only allowed Pexels keywords for cover backgrounds.
 * All products use the same safe set to avoid architecture/building/interior photos.
 */
export function getSafeCoverKeyword(_niche: string, _format?: string): string {
  return SAFE_COVER_KEYWORDS_ALL[Math.floor(Math.random() * SAFE_COVER_KEYWORDS_ALL.length)];
}

/** If query contains any banned keyword, return default safe query; otherwise return query as-is. */
export function sanitizePexelsQuery(query: string): string {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return DEFAULT_SAFE_KEYWORD;
  const hasBanned = BANNED_PEXELS_KEYWORDS.some((banned) => q.includes(banned));
  if (hasBanned) return DEFAULT_SAFE_KEYWORD;
  return query.trim();
}

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
  /** When true, ask for a noticeably different design (different colours, fonts, image keyword). */
  regenerate?: boolean;
  /** Fingerprints of designs already used (e.g. "primary|secondary|headingFont|bodyFont") — avoid suggesting these again. */
  previousDesignFingerprints?: string[];
};

export async function getAutoDesignSuggestion(
  input: AutoDesignInput
): Promise<AutoDesignSuggestion> {
  const { title, niche, format, brandPrimary, brandSecondary, regenerate, previousDesignFingerprints } = input;
  const useBrandColors = Boolean(
    brandPrimary?.trim() && brandSecondary?.trim()
  );
  const productFormat = (format ?? "ebook").toLowerCase().trim();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const avoidList =
    regenerate && previousDesignFingerprints?.length
      ? `\n\nThe user has already seen these design combinations (do NOT suggest the same again). Each is "primary|secondary|headingFont|bodyFont". Pick clearly different colours and different fonts:\n${previousDesignFingerprints.slice(-10).join("\n")}`
      : "";
  const regenerateHint = regenerate
    ? `\n\nIMPORTANT: This is a REGENERATION. The user already saw a previous design. Choose a COMPLETELY DIFFERENT style: different colour palette (different hues, not just shades), different heading and body fonts. Surprise them with a fresh look.${avoidList}`
    : "";

  const prompt = `You are a digital product design expert. Suggest a UNIQUE design for THIS product type. Each format (Ebook, Workbook, Planner, Journal, etc.) must look different.

Product title: ${title || "Untitled"}
Topic/niche: ${niche || "General"}
Product format: ${productFormat}
${regenerateHint}

Choose a distinct style and colour palette that fits this format. Ebook = elegant/readable; Workbook = inviting/activity feel; Planner = clean/organised; Journal = calm/reflective. Use different fonts and colours per format.

Return ONLY a valid JSON object (no markdown, no code fence) with exactly these keys:

- "primary": string, hex for main text/headings. Contrast with overlay: dark overlay → light text (#ffffff, #f8fafc); light overlay → dark text (#1a1a1a).
- "secondary": string, hex for body text. Same contrast rule.
- "accent": string, hex for subheadings/highlights.
- "headingFont": string, one CSS-safe font (e.g. Playfair Display, Montserrat, Georgia, Inter). Vary by format.
- "bodyFont": string, one CSS-safe font (e.g. Inter, Open Sans, Lato). Vary by format.
- "overlayColor": string, SOLID hex only (#000000 or #1a1a2e for dark; #ffffff or #f8fafc for light). No patterns.
- "overlayOpacity": number, 0.35 to 0.6. Prefer 0.45-0.55.
- "contentPageBackgroundColor": string, hex for content pages (#ffffff, #f8fafc, etc.).`;


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
      temperature: regenerate ? 0.9 : 0.6,
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
  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error("No design suggestion returned");
  }
  // Strip markdown code fences (```json ... ``` or ``` ... ```) that OpenAI sometimes adds
  const content = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    console.error("[auto-design-suggestion] JSON parse failed. Raw content:", rawContent);
    throw new Error("Design suggestion was not valid JSON");
  }
  const overlayOpacityRaw = parsed.overlayOpacity;
  const overlayOpacityUnclamped =
    typeof overlayOpacityRaw === "number" && overlayOpacityRaw >= 0 && overlayOpacityRaw <= 1
      ? overlayOpacityRaw
      : 0.5;
  const overlayOpacity = Math.min(0.6, overlayOpacityUnclamped);

  // Cover background uses ONLY safe niche-based keywords — never AI-suggested (avoids architecture/buildings).
  const pexelsKeyword = getSafeCoverKeyword(niche, productFormat);

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
    pexelsKeyword,
    overlayColor: normalizeHex(String(parsed.overlayColor ?? "#000000")),
    overlayOpacity,
    contentPageBackgroundColor: normalizeHex(
      String(parsed.contentPageBackgroundColor ?? "#ffffff")
    ),
  };
}
