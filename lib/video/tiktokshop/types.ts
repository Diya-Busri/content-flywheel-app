/**
 * TikTok Shop demo video generator V1 – types.
 */

export type VideoSourceMode = "user_clips" | "ai_generated" | "hybrid";

export type ProductData = {
  name: string;
  description?: string;
  keyBenefits: string[];
  price?: string;
  claim?: string;
  ctaText?: string;
  productImageUrl?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  /** Required for user_clips and hybrid (scene 3). Empty for ai_generated. */
  demoClipUrls: string[];
  /** How scene visuals are sourced. Default: user_clips */
  videoSourceMode?: VideoSourceMode;
  /** Optional: reference video URL for structure extraction (blueprint only, no copying). */
  inputVideoUrl?: string;
};

/** Structure blueprint from reference video (no copying of script or visuals). */
export type StructureBlueprint = {
  hookType: string;
  pacing: string;
  ctaStyle: string;
  transcriptSummary?: string;
  sceneDurationsHint?: number[];
};

export type SceneType = "hook" | "problem" | "demo" | "result" | "cta";

export type Scene = {
  sceneIndex: number;
  sceneType: SceneType;
  durationSec: number;
  voiceLine: string;
  onScreenText: string;
  requiresProductOverlay: boolean;
  requiresBeforeAfter: boolean;
};

export type ScriptResult = {
  fullNarration: string;
  scenes: Scene[];
};

export type SceneAssetPlan = {
  sceneIndex: number;
  clipUrl: string;
  productOverlayUrl?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  voiceLine: string;
  onScreenText: string;
};

export type CreatomateVariables = Record<string, string | number | boolean>;
