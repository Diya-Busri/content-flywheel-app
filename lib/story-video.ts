/**
 * Shared defaults for the story-video API + Template Studio (mode 15).
 */

/** Core anime style line for DALL·E (prefix + locked suffix + generate-image closer). */
export const STORY_VIDEO_IMAGE_ANIME_STYLE_CORE =
  "2D anime illustration, cel-shaded flat colours, Studio Ghibli inspired, soft warm tones, clean line art, cartoon, NOT photorealistic, NOT 3D render";

export const STORY_VIDEO_DEFAULT_ART_STYLE =
  `${STORY_VIDEO_IMAGE_ANIME_STYLE_CORE}, no text, no watermark`;

/** Prepended to scene image prompts in Template Studio Story Video (DALL·E path). */
export const STORY_VIDEO_FIXED_CHARACTER_SEED =
  "A young male figure seen from behind or side, dark messy hair, blue t-shirt, never showing full face clearly — seen from over-the-shoulder or wide shot only";

/** Script / image_prompt instructions so scenes avoid front-facing portraits. */
export const STORY_VIDEO_VISUAL_CHARACTER_FRAMING_RULE =
  "Whenever a person appears: show them only from behind, in side profile, or as a silhouette — never a front-facing portrait or a clear full face toward the camera. Prefer over-the-shoulder, wide shot, or back-to-camera framing.";

export type StoryVideoFormat = "short" | "long";

export type StoryVideoVideoStructure = "full_story" | "educational" | "motivational";

export const STORY_VIDEO_SCENE_SHORT = { min: 3, max: 16, default: 6 } as const;
export const STORY_VIDEO_SCENE_LONG = { min: 15, max: 50, default: 15 } as const;

export const STORY_VIDEO_FORMAT_OPTIONS: { value: StoryVideoFormat; label: string }[] = [
  { value: "short", label: "Short Form (TikTok/Reels)" },
  { value: "long", label: "Long Form (YouTube)" },
];

export const STORY_VIDEO_VIDEO_STRUCTURE_OPTIONS: {
  value: StoryVideoVideoStructure;
  label: string;
}[] = [
  { value: "full_story", label: "Full Story" },
  { value: "educational", label: "Educational" },
  { value: "motivational", label: "Motivational" },
];

export function parseStoryVideoFormatFromBody(body: Record<string, unknown>): StoryVideoFormat {
  const f =
    typeof body.format === "string"
      ? body.format.trim().toLowerCase()
      : typeof body.videoFormat === "string"
        ? body.videoFormat.trim().toLowerCase()
        : "";
  return f === "long" || f === "youtube" || f === "long_form" ? "long" : "short";
}

export function parseStoryVideoStructureFromBody(body: Record<string, unknown>): StoryVideoVideoStructure {
  const s =
    typeof body.video_structure === "string"
      ? body.video_structure.trim().toLowerCase()
      : typeof body.videoStructure === "string"
        ? body.videoStructure.trim().toLowerCase()
        : "";
  if (s === "educational") return "educational";
  if (s === "motivational") return "motivational";
  return "full_story";
}

export function clampStoryVideoSceneCount(count: number, format: StoryVideoFormat): number {
  const bounds = format === "long" ? STORY_VIDEO_SCENE_LONG : STORY_VIDEO_SCENE_SHORT;
  const n = Math.floor(count);
  if (!Number.isFinite(n)) return bounds.default;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

/**
 * Sanitize story-video scene visual descriptions before image APIs (FLUX/fal, DALL-E–class filters).
 * Removes/replaces poverty-, mess-, struggle-, and low-mood wording with neutral productive alternatives.
 * Longer phrases first. Used by `/api/story-video/generate-images` before fal.ai and by script post-processing.
 */
export function sanitizeStoryVideoVisualDescription(raw: string): string {
  let s = raw.trim();
  if (!s) return s;

  // Preserve "stand alone" before whole-word "alone" replacement
  s = s.replace(/\bstand\s*[- ]?alone\b/gi, "standalone");

  const phraseReplacements: [RegExp, string][] = [
    // User-requested exact swaps (longer / specific first)
    [/\bclothes\s+on\s+the\s+floor\b/gi, "books on the desk"],
    [/\bhalf[- ]open\s+window\b/gi, "sunlit window"],
    [/\bcluttered\s+room\b/gi, "cosy bedroom"],
    [/\bdim\s+room\b/gi, "softly lit room"],
    [/\bevening\s+light\b/gi, "afternoon light"],
    [/\bminimum\s*[- ]?wage\b/gi, ""],
    [/\bliving\s+paycheck\s+to\s+paycheck\b/gi, "steady daily rhythm"],
    [/\bdead[- ]end\s+job\b/gi, "new opportunity"],
    [/\bfinancial\s+ruin\b/gi, "fresh start"],
    [/\btrash[- ]strewn\b/gi, "neatly arranged supplies"],
    [/\bdirty\s+clothes\b/gi, "folded linens"],
    [/\bempty\s+wallet\b/gi, "simple desk with everyday items"],
    [/\bin\s+the\s+dark\b/gi, "in soft ambient light"],
    [/\bdark\s+interior\b/gi, "calm interior"],
    [/\bdark\s+space\b/gi, "open calm space"],
    [/\bdark\s+corner\b/gi, "quiet corner"],
    [/\bdark\s+room\b/gi, "quiet room"],
    [/\bdimly\s*[- ]?\s*lit\b/gi, "softly lit"],
    [/\bdesk\s+lamp\b/gi, "soft ambient light"],
    [/\bstruggling\b/gi, "focused"],
    [/\boverwhelmed\b/gi, "thinking deeply"],
    [/\bbroke\b/gi, "determined"],
    [/\bfrustrated\b/gi, "thoughtful"],
    [/\bdesperate\b/gi, "motivated"],
    [/\bsqualid\b/gi, "simple"],
    [/\bdilapidated\b/gi, "vintage"],
    [/\brundown\b/gi, "quiet"],
    [/\bgrimy\b/gi, "bright"],
    [/\bfilthy\s+room\b/gi, "bright tidy room"],
    [/\bfilthy\b/gi, "clean"],
    [/\boverflowing\s+trash\b/gi, "full recycling bin"],
    [/\btrash\s+heap\b/gi, "storage corner"],
    [/\bgarbage\s+strewn\b/gi, "organized shelves"],
    [/\bunpaid\s+bills\b/gi, "notebook and planner"],
    [/\beviction\b/gi, "moving forward"],
    [/\brepossessed\b/gi, "fresh chapter"],
    [/\bforeclosure\b/gi, "new beginning"],
    [/\bpowerless\b/gi, "thoughtful"],
    [/\bhelpless\b/gi, "supported"],
    [/\bhopeless\b/gi, "determined"],
    [/\bdefeated\b/gi, "reflective"],
    [/\bexhausted\b/gi, "restful moment"],
    [/\bstarving\b/gi, "focused"],
    [/\bscraping\s+by\b/gi, "building steadily"],
    [/\bdown\s+and\s+out\b/gi, "on a new path"],
    [/\binsolvent\b/gi, "planning ahead"],
    [/\bindigent\b/gi, "modest circumstances"],
    [/\bdestitute\b/gi, "resourceful"],
    [/\bpenniless\b/gi, "budget-conscious"],
    [/\bhomeless\b/gi, "traveling light"],
    [/\bpoverty[- ]stricken\b/gi, "hardworking"],
    [/\bin\s+poverty\b/gi, "working toward goals"],
    [/\bpoverty\b/gi, "growth"],
    [/\bneglected\s+room\b/gi, "well-kept room"],
    [/\bchaotic\s+room\b/gi, "lively organized space"],
    [/\bdisorganized\s+mess\b/gi, "creative workspace"],
    [/\bpoor\s+family\b/gi, "close-knit family"],
    [/\bpoor\s+neighborhood\b/gi, "friendly neighborhood"],
    [/\bdingy\b/gi, "cozy"],
    [/\bunkempt\b/gi, "relaxed"],
  ];

  for (const [re, rep] of phraseReplacements) {
    s = s.replace(re, rep);
  }

  const wordReplacements: [RegExp, string][] = [
    [/\bmessy\b/gi, "tidy"],
    [/\bclutter\b/gi, "order"],
    [/\bstruggle\b/gi, "effort"],
    [/\bstruggles\b/gi, "efforts"],
    [/\bscrounging\b/gi, "preparing"],
    [/\bhoarder\b/gi, "enthusiast"],
    [/\bhoarded\b/gi, "stacked"],
    [/\broach[- ]infested\b/gi, "cozy vintage"],
    [/\bvermin\b/gi, "wildlife outside"],
  ];
  for (const [re, rep] of wordReplacements) {
    s = s.replace(re, rep);
  }

  s = s.replace(/\balone\b/gi, "focused");

  // Remaining "dark" as mood/lighting (keep "dark blue", "dark wood", etc.)
  s = s.replace(
    /\bdark\b(?!\s*(?:blue|green|brown|grey|gray|red|hair|wood|suit|chocolate|skin|mode|matter|magic|knight|age|web|arts|comedy|humor|jeans|denim))/gi,
    "calm"
  );

  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
}
