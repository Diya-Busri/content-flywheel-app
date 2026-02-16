/**
 * TikTok Shop Demo video pipeline types.
 */

export type ProductData = {
  name: string;
  description?: string;
  imageUrl?: string;
  productLink?: string;
  [key: string]: unknown;
};

export type TikTokSceneType = "hook" | "problem" | "demo" | "result" | "cta";

export type TikTokScene = {
  sceneIndex: number;
  sceneType: TikTokSceneType;
  voiceLine: string;
  onScreenText: string;
  requiresProductShot: boolean;
  requiresBeforeAfter: boolean;
};

export type TikTokScriptResult = {
  fullNarration: string;
  scenes: TikTokScene[];
};

export type ProductAssets = {
  /** Main product image URL */
  imageUrl?: string;
  /** Before state (for before/after) */
  beforeImageUrl?: string;
  /** After state (for before/after) */
  afterImageUrl?: string;
};

export type CreatomatePayload = {
  template_id: string;
  modifications: Record<string, string | number | boolean>;
};
