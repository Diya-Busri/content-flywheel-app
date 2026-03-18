export type CreationMode = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type TemplateType = "quotes" | "tips" | "affirmations";
export type FontStyle = "modern" | "elegant" | "bold" | "minimal";
export type SlideItem = { heading: string; body: string; bg_color?: string };
export type CaptionItem = { caption: string; hashtags: string; alt_text: string };
export type AiStoryScene = { sceneNumber: number; dialogue: string; imagePrompt: string; motionPrompt: string };

export const CREATION_MODE_OPTIONS: { value: CreationMode; label: string }[] = [
  { value: "2", label: "Promote My App or Business" },
  { value: "3", label: "Promote My Clothing Brand" },
  { value: "1", label: "Share Knowledge/Tips" },
  { value: "4", label: "Motivational Content" },
  { value: "5", label: "Viral Hook Carousel (For Growth)" },
  { value: "6", label: "Sales/Product Launch Carousel" },
  { value: "7", label: "AI Story" },
];

export const AI_STORY_TONE_OPTIONS = [
  { value: "Sad", label: "Sad" },
  { value: "Dramatic", label: "Dramatic" },
  { value: "Shocking", label: "Shocking" },
];

export const TEMPLATE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: "quotes", label: "Quotes" },
  { value: "tips", label: "Tips" },
  { value: "affirmations", label: "Affirmations" },
];

export const POST_GOAL_OPTIONS = [
  { value: "tease drop", label: "Tease drop" },
  { value: "build community", label: "Build community" },
  { value: "announce launch", label: "Announce launch" },
  { value: "aesthetic content", label: "Aesthetic content" },
];

export const HOOK_ANGLE_OPTIONS = [
  { value: "Problem/Pain Point", label: "Problem/Pain Point (e.g., \"Stop dressing boring\")" },
  { value: "Controversial Take", label: "Controversial Take (e.g., \"Minimalism is overrated\")" },
  { value: "Curiosity Gap", label: "Curiosity Gap (e.g., \"3 styling secrets brands hide\")" },
  { value: "Social Proof", label: "Social Proof (e.g., \"How I grew to 10k followers\")" },
  { value: "Transformation", label: "Transformation (e.g., \"Before I knew these rules...\")" },
];

export const CTA_GOAL_OPTIONS = [
  { value: "Get followers", label: "Get followers (CTA: \"Follow for more\")" },
  { value: "Get saves", label: "Get saves (CTA: \"Save this for later\")" },
  { value: "Drive link clicks", label: "Drive link clicks (CTA: \"Link in bio\")" },
  { value: "Get engagement", label: "Get engagement (CTA: \"Comment your favorite\")" },
];

export const SLIDE_COUNT_OPTIONS = [5, 10, 20] as const;
export const SLIDE_COUNT_VIRAL_OPTIONS = [5, 6, 7, 8, 9, 10] as const;

export const FONT_OPTIONS: { value: FontStyle; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "elegant", label: "Elegant" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" },
];
