export type CreationMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** Story-style Template Studio modes that share the 8-scene pipeline */
export type TemplateStudioStoryTemplateId = "ai_story" | "satisfying_build";

export const TEMPLATE_STUDIO_STORY_GENERATE_ROUTES: Record<
  TemplateStudioStoryTemplateId,
  string
> = {
  ai_story: "/api/content-studio/ai-story/generate",
  satisfying_build: "/api/generate/satisfying-build",
};
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
  { value: "8", label: "Satisfying Build" },
  { value: "9", label: "🖊️ Stickman Whiteboard Video" },
];

export const AI_STORY_TONE_OPTIONS = [
  { value: "Sad", label: "Sad" },
  { value: "Dramatic", label: "Dramatic" },
  { value: "Shocking", label: "Shocking" },
];

export const SATISFYING_BUILD_CHARACTER_TYPES = [
  { value: "Person", label: "Person" },
  { value: "Fruit Character", label: "Fruit Character" },
  { value: "Robot", label: "Robot" },
  { value: "Animal", label: "Animal" },
  { value: "Tech Gadget", label: "Tech Gadget" },
] as const;

export const SATISFYING_BUILD_STYLE_OPTIONS = [
  { value: "Miniature Construction", label: "Miniature Construction" },
  { value: "Giant Object Build", label: "Giant Object Build" },
  { value: "Impossible Engineering", label: "Impossible Engineering" },
  { value: "Cozy Cottage Build", label: "Cozy Cottage Build" },
] as const;

export const SATISFYING_BUILD_TONE_OPTIONS = [
  { value: "Satisfying", label: "Satisfying" },
  { value: "Dramatic", label: "Dramatic" },
  { value: "Wholesome", label: "Wholesome" },
  { value: "Chaotic", label: "Chaotic" },
] as const;

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
