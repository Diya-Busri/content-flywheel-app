export type VideoStyle = "unboxing" | "demo" | "before-after";

export type ProductDetails = {
  name: string;
  description: string;
  imageUrl?: string;
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
