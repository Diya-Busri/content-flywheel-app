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
