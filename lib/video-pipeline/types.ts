/**
 * Shared types for the video generation pipeline.
 */

export type ProductData = {
  name: string;
  description?: string;
  imageUrl?: string;
  productLink?: string;
  [key: string]: unknown;
};

export type Scene = {
  sceneIndex: number;
  visualDescription: string;
  voiceLine: string;
  onScreenText: string;
  requiresProductShot: boolean;
};

export type StructuredScriptResult = {
  fullNarration: string;
  scenes: Scene[];
};

export type ProductAssets = {
  imageUrl?: string;
  mockupUrl?: string;
};

export type CreatomatePayload = {
  template_id: string;
  modifications: Record<string, string | number | boolean>;
};

export type VideoStyle = "unboxing" | "promo" | "demo" | "beforeAfter";
