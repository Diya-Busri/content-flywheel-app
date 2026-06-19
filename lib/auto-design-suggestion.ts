/**
 * Server-side auto-design suggestion (OpenAI). Used by /api/auto-design and /api/products/[id]/apply-design.
 */

/**
 * Truly off-topic content that should never appear on any product cover regardless of niche.
 * Kept intentionally narrow — don't over-ban or we lose niche relevance.
 */
export const BANNED_PEXELS_KEYWORDS = [
  "bird",
  "animal",
  "cat",
  "dog",
  "wildlife",
  "food",
  "meal",
  "macaron",
  "dessert",
  "cake",
  "bakery",
  "corridor",
  "hallway",
  "entrance",
] as const;

/**
 * Niche-category to Pexels search term mapping.
 * Used as fallback when AI suggestion fails validation.
 * Each entry is an array so we can rotate to avoid repetition.
 */
const NICHE_KEYWORD_MAP: Record<string, string[]> = {
  // Home & Interior
  "home decor": ["modern interior", "living room design", "home styling"],
  "interior design": ["modern interior", "home decor", "room design"],
  "augmented reality": ["smart home technology", "futuristic interface", "digital overlay"],
  "ar home": ["modern interior", "smart home", "home technology"],
  "real estate": ["modern home exterior", "luxury property", "house architecture"],
  "renovation": ["modern interior renovation", "home improvement", "construction design"],

  // Fitness & Health
  "fitness": ["gym workout", "active lifestyle", "exercise training"],
  "weight loss": ["fitness training", "healthy lifestyle", "gym equipment"],
  "yoga": ["yoga practice", "mindfulness meditation", "wellness"],
  "nutrition": ["healthy food", "wellness lifestyle", "clean eating"],
  "health": ["wellness lifestyle", "healthy living", "medical professional"],
  "mental health": ["mindfulness calm", "meditation wellness", "peaceful nature"],

  // Finance & Business
  "finance": ["business growth charts", "financial success", "professional office"],
  "investing": ["stock market charts", "wealth building", "financial growth"],
  "money": ["business success", "financial planning", "professional finance"],
  "business": ["professional office", "business meeting", "corporate success"],
  "entrepreneur": ["business startup", "entrepreneurship", "professional success"],
  "marketing": ["digital marketing", "social media strategy", "business growth"],
  "sales": ["business success", "sales professional", "corporate growth"],
  "ecommerce": ["online shopping", "digital commerce", "business technology"],

  // Technology
  "technology": ["futuristic technology", "digital innovation", "tech interface"],
  "ai": ["artificial intelligence", "digital technology", "data visualization"],
  "software": ["software development", "code technology", "digital innovation"],
  "coding": ["programming code", "software development", "tech workspace"],
  "data": ["data visualization", "analytics dashboard", "technology abstract"],
  "cybersecurity": ["digital security", "cyber technology", "data protection"],

  // Creative & Design
  "design": ["creative design workspace", "graphic design", "artistic workspace"],
  "photography": ["professional photography", "camera photography", "creative studio"],
  "art": ["creative art studio", "painting art", "artistic workspace"],
  "writing": ["writing workspace", "author desk", "creative writing"],
  "music": ["music studio", "musical instruments", "audio recording"],

  // Education & Self-improvement
  "education": ["learning classroom", "study books", "academic success"],
  "productivity": ["organized workspace", "productivity planning", "focused work"],
  "mindset": ["motivation success", "personal growth", "inspiration"],
  "leadership": ["business leadership", "professional success", "team management"],
  "career": ["professional career", "job success", "workplace professional"],

  // Lifestyle
  "travel": ["travel destination", "adventure travel", "landscape travel"],
  "fashion": ["fashion style", "clothing design", "modern style"],
  "beauty": ["beauty cosmetics", "skincare routine", "makeup professional"],
  "parenting": ["family parenting", "children family", "parent child"],
  "relationship": ["couple relationship", "romance love", "relationship happiness"],
  "lifestyle": ["modern lifestyle", "wellness lifestyle", "contemporary living"],

  // Social Media & Content
  "social media": ["social media digital", "content creation", "influencer lifestyle"],
  "youtube": ["video content creation", "youtube studio", "content creator"],
  "instagram": ["social media content", "lifestyle photography", "visual content"],
  "content creation": ["content creator workspace", "digital media", "creative content"],
};

/** Safe generic fallbacks tried in order when niche map and AI both fail. */
const GENERIC_SAFE_KEYWORDS = ["abstract", "gradient", "bokeh", "texture"] as const;

/** Guaranteed fallback keywords tried in order when the primary query returns nothing. */
export const PEXELS_FALLBACK_KEYWORDS = [...GENERIC_SAFE_KEYWORDS] as readonly string[];

const DEFAULT_SAFE_KEYWORD = GENERIC_SAFE_KEYWORDS[0];

/**
 * Return a random safe Pexels keyword for cover backgrounds (used when preference is "random").
 */
export function getRandomCoverKeyword(): string {
  return GENERIC_SAFE_KEYWORDS[Math.floor(Math.random() * GENERIC_SAFE_KEYWORDS.length)];
}

/**
 * Look up the best Pexels keyword for a given niche using the category map.
 * Falls back to generic safe keywords if no match found.
 */
export function getSafeCoverKeyword(niche: string, _format?: string): string {
  if (!niche?.trim()) return DEFAULT_SAFE_KEYWORD;

  const n = niche.toLowerCase().trim();

  // Try exact and partial match against our niche map
  for (const [key, keywords] of Object.entries(NICHE_KEYWORD_MAP)) {
    if (n.includes(key) || key.includes(n)) {
      return keywords[Math.floor(Math.random() * keywords.length)];
    }
  }

  // No map match — return generic abstract fallback
  return GENERIC_SAFE_KEYWORDS[Math.floor(Math.random() * GENERIC_SAFE_KEYWORDS.length)];
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
- "contentPageBackgroundColor": string, hex for content pages (#ffffff, #f8fafc, etc.).
- "pexelsKeyword": string, a specific 1-3 word Pexels search term that visually represents the product niche. RULES: (1) Must directly relate to the niche — if the topic is removed from the cover, the image alone must tell the viewer what the product is about. (2) Use concrete visual subjects, not abstract concepts (e.g. "modern interior design" not "interior"; "gym workout" not "fitness"). (3) Never suggest: food, animals, birds, wildlife, macarons, desserts, or anything unrelated to the niche. (4) Examples by niche: AR/home decor → "modern interior design"; fitness → "gym workout training"; finance → "business growth charts"; technology → "futuristic digital interface"; yoga → "yoga meditation practice"; marketing → "digital marketing strategy".`;


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
      max_tokens: 500,
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

  // Validate AI-suggested keyword: reject if it contains banned terms, then fall back to niche map, then generic.
  const aiPexelsRaw = typeof parsed.pexelsKeyword === "string" ? parsed.pexelsKeyword.trim() : "";
  const pexelsKeyword = aiPexelsRaw && !BANNED_PEXELS_KEYWORDS.some((b) => aiPexelsRaw.toLowerCase().includes(b))
    ? aiPexelsRaw
    : getSafeCoverKeyword(niche, productFormat);

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
