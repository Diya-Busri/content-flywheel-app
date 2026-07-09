export type VideoStyle = "unboxing" | "demo" | "before-after";

export type HookStyle =
  | "problem"
  | "story"
  | "controversial"
  | "before-after"
  | "comparison"
  | "tiktok-made-me-buy"
  | "question"
  | "stat";

export type ScriptTone =
  | "soft-aesthetic"
  | "aggressive"
  | "luxury"
  | "budget"
  | "ugc-style";

export type VideoBuildMode =
  | "ai-avatar"
  | "stock-captions"
  | "product-animation"
  | "product-in-hand"
  | "mixed";

export type ProductDetails = {
  name: string;
  description: string;
  imageUrl?: string;
};

/** Structured script for viral TikTok Shop UGC. Short, punchy, conversion-style. */
export type ScriptScenes = {
  hook: string;
  pain: string;
  solution: string;
  /** Short proof points (e.g. "Lasts 24hr" or "No parabens"). Shown in solution scene. */
  proof_points?: string[];
  cta: string;
};

/** Full script + scene breakdown for voiceover and per-scene text. */
export type ScriptWithScenes = {
  fullScript: string;
  scenes: ScriptScenes;
};

export type ScriptResult = {
  script: string;
  segments?: string[];
};

export type PlatformAspectRatio = {
  width: number;
  height: number;
};

export const PLATFORM_ASPECT_RATIOS: Record<string, PlatformAspectRatio> = {
  tiktok: { width: 1080, height: 1920 },
  instagram: { width: 1080, height: 1920 },
  youtube: { width: 1920, height: 1080 },
};
