export type CreationMode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21" | "22";

/** Story-style Template Studio modes that share the scene pipeline */
export type TemplateStudioStoryTemplateId =
  | "ai_story"
  | "satisfying_build"
  | "ai_cooking_video"
  | "story_video"
  | "finance_documentary";

export const TEMPLATE_STUDIO_STORY_GENERATE_ROUTES: Record<
  TemplateStudioStoryTemplateId,
  string
> = {
  ai_story: "/api/content-studio/ai-story/generate",
  satisfying_build: "/api/generate/satisfying-build",
  ai_cooking_video: "/api/generate/ai-cooking-video",
  story_video: "/api/generate/story-video",
  finance_documentary: "/api/generate/finance-documentary",
};
export type TemplateType = "quotes" | "tips" | "affirmations";
export type FontStyle = "modern" | "elegant" | "bold" | "minimal";
export type SlideItem = { heading: string; body: string; bg_color?: string };
export type CaptionItem = { caption: string; hashtags: string; alt_text: string };
export type AiStoryScene = { sceneNumber: number; dialogue: string; imagePrompt: string; motionPrompt: string };

/** Preset groups for Template Studio setup (values must stay stable for saved drafts / API). */
export const CREATION_MODE_OPTION_GROUPS: {
  label: string;
  options: { value: CreationMode; label: string }[];
}[] = [
  {
    label: "Library",
    options: [{ value: "14", label: "Show & episode (My Library grouping)" }],
  },
  {
    label: "Content Type",
    options: [
      { value: "1", label: "Share Knowledge/Tips" },
      { value: "4", label: "Motivational Content" },
      { value: "5", label: "Viral Hook Carousel" },
    ],
  },
  {
    label: "Promote Something",
    options: [
      { value: "2", label: "Promote My App or Business" },
      { value: "3", label: "Promote My Clothing Brand" },
      { value: "6", label: "Sales/Product Launch Carousel" },
      { value: "18", label: "🚀 Drop Campaign (7-Day Launch)" },
    ],
  },
  {
    label: "Faceless Channels",
    options: [
      { value: "17", label: "💰 Finance Documentary" },
      { value: "21", label: "🏛️ History Documentary" },
      { value: "22", label: "💻 Tech Documentary" },
    ],
  },
  {
    label: "AI Templates",
    options: [
      { value: "7", label: "AI Story" },
      { value: "8", label: "Satisfying Build" },
      { value: "9", label: "AI Cooking Video" },
      { value: "10", label: "Brand Story Video" },
      { value: "11", label: "🖊️ Stickman Whiteboard Video" },
      { value: "12", label: "🎯 Would You Rather / Quiz" },
      { value: "13", label: "⚡ Kinetic Typography Video" },
      { value: "15", label: "Story Video" },
      { value: "16", label: "🎬 AI Animation Video Prompts" },
      { value: "19", label: "🎌 Anime Story Video" },
      { value: "20", label: "✏️ Stickman Story Video" },
    ],
  },
];

export const CREATION_MODE_OPTIONS: { value: CreationMode; label: string }[] =
  CREATION_MODE_OPTION_GROUPS.flatMap((g) => g.options);

export const AI_STORY_TONE_OPTIONS = [
  { value: "Sad", label: "Sad" },
  { value: "Dramatic", label: "Dramatic" },
  { value: "Shocking", label: "Shocking" },
];

export const STORY_VIDEO_TONE_OPTIONS = [
  { value: "motivational", label: "Motivational" },
  { value: "educational", label: "Educational" },
  { value: "story", label: "Story" },
] as const;

export const SATISFYING_BUILD_CHARACTER_TYPES = [
  { value: "Person", label: "Person" },
  { value: "Fruit Character", label: "Fruit Character" },
  { value: "Robot", label: "Robot" },
  { value: "Animal", label: "Animal" },
  { value: "Tech Gadget", label: "Tech Gadget" },
  { value: "Toy Figure", label: "Toy Figure" },
  { value: "Monster", label: "Monster" },
  { value: "Alien", label: "Alien" },
  { value: "Fantasy Creature", label: "Fantasy Creature" },
  { value: "Construction Crew", label: "Construction Crew" },
] as const;

export const SATISFYING_BUILD_STYLE_OPTIONS = [
  { value: "Construction Time-lapse", label: "🏗️ Construction Time-lapse (real people building)" },
  { value: "Miniature Construction", label: "Miniature Construction" },
  { value: "Giant Object Build", label: "Giant Object Build" },
  { value: "Impossible Engineering", label: "Impossible Engineering" },
  { value: "Cozy Cottage Build", label: "Cozy Cottage Build" },
  { value: "Lego-Style Build", label: "Lego-Style Build" },
  { value: "Futuristic Sci-Fi Build", label: "Futuristic Sci-Fi Build" },
  { value: "Nature Survival Build", label: "Nature Survival Build" },
  { value: "Luxury Architecture Build", label: "Luxury Architecture Build" },
  { value: "Transformation", label: "Transformation (Before → During → After)" },
] as const;

export const SATISFYING_BUILD_IMAGE_STYLE_OPTIONS = [
  { value: "Miniature/Stylized", label: "Miniature / Stylized (default)" },
  { value: "Realistic Photography", label: "Realistic Photography" },
] as const;

export const SATISFYING_BUILD_SCENE_COUNT_OPTIONS = [
  { value: "8", label: "8 scenes (~40 sec)" },
  { value: "12", label: "12 scenes (~1 min)" },
  { value: "16", label: "16 scenes (~80 sec)" },
] as const;

export const SATISFYING_BUILD_TONE_OPTIONS = [
  { value: "Satisfying", label: "Satisfying" },
  { value: "Dramatic", label: "Dramatic" },
  { value: "Wholesome", label: "Wholesome" },
  { value: "Chaotic", label: "Chaotic" },
  { value: "Epic", label: "Epic" },
  { value: "Comedic", label: "Comedic" },
  { value: "ASMR", label: "ASMR" },
] as const;

export const AI_COOKING_VIDEO_CHEF_TYPES = [
  { value: "Home Cook", label: "Home Cook" },
  { value: "Pro Chef", label: "Pro Chef" },
  { value: "Grandma Style", label: "Grandma Style" },
  { value: "Street Food Vendor", label: "Street Food Vendor" },
  { value: "Anime Chef", label: "Anime Chef" },
  { value: "Meal Prep Coach", label: "Meal Prep Coach" },
  { value: "BBQ Pitmaster", label: "BBQ Pitmaster" },
  { value: "Pastry Chef", label: "Pastry Chef" },
  { value: "Vegan Chef", label: "Vegan Chef" },
  { value: "Food Scientist", label: "Food Scientist" },
] as const;

export const AI_COOKING_VIDEO_STYLE_OPTIONS = [
  { value: "Cozy Home Kitchen", label: "Cozy Home Kitchen" },
  { value: "Fast TikTok Recipe", label: "Fast TikTok Recipe" },
  { value: "Luxury Fine Dining", label: "Luxury Fine Dining" },
  { value: "Street Food Energy", label: "Street Food Energy" },
  { value: "ASMR Close-Up", label: "ASMR Close-Up" },
  { value: "Rustic Farmhouse", label: "Rustic Farmhouse" },
  { value: "Outdoor Campfire Cooking", label: "Outdoor Campfire Cooking" },
  { value: "Minimalist Meal Prep", label: "Minimalist Meal Prep" },
  { value: "Late-Night Neon Bites", label: "Late-Night Neon Bites" },
  { value: "Documentary Slow TV", label: "Documentary Slow TV" },
  { value: "Handheld Street Stall", label: "Handheld Street Stall" },
  { value: "Crisp Daylight Counter", label: "Crisp Daylight Counter" },
  { value: "Studio Macro Hero", label: "Studio Macro Hero" },
  { value: "Steam & Backlight Drama", label: "Steam & Backlight Drama" },
  { value: "Single-Pan Weeknight", label: "Single-Pan Weeknight" },
  { value: "Open-Air Garden Table", label: "Open-Air Garden Table" },
  { value: "Pro Chef Expo Line", label: "Pro Chef Expo Line" },
] as const;

export const AI_COOKING_VIDEO_TONE_OPTIONS = [
  { value: "Satisfying", label: "Satisfying" },
  { value: "Wholesome", label: "Wholesome" },
  { value: "Hyped", label: "Hyped" },
  { value: "Calm ASMR", label: "Calm ASMR" },
  { value: "Educational", label: "Educational" },
  { value: "Comedic", label: "Comedic" },
  { value: "Luxury", label: "Luxury" },
  { value: "Deadpan Fast", label: "Deadpan Fast" },
  { value: "Warm Confessional", label: "Warm Confessional" },
  { value: "Play-by-Play Sportscaster", label: "Play-by-Play Sportscaster" },
  { value: "Understated Pro", label: "Understated Pro" },
  { value: "Chaos Fun", label: "Chaos Fun" },
] as const;

/** AI Cooking Video: how many Template Studio scenes to generate (full recipe beats). */
export const AI_COOKING_VIDEO_SCENE_COUNT_OPTIONS = [8, 10, 12, 14, 16] as const;

export type AiCookingVideoSceneCountChoice =
  | "auto"
  | (typeof AI_COOKING_VIDEO_SCENE_COUNT_OPTIONS)[number];

/** UI: default "auto" lets the API pick 8–16 scenes based on recipe complexity. */
export const AI_COOKING_VIDEO_SCENE_COUNT_SELECT: { value: string; label: string }[] = [
  { value: "auto", label: "Auto — 8–16 scenes from recipe complexity" },
  ...AI_COOKING_VIDEO_SCENE_COUNT_OPTIONS.map((n) => ({
    value: String(n),
    label: `${n} scenes (fixed)`,
  })),
];

// ── Finance / Business Documentary (Mode 17) ──────────────────────────────
export const FINANCE_DOC_NICHE_OPTIONS = [
  { value: "Personal Finance", label: "💵 Personal Finance" },
  { value: "Investing & Stocks", label: "📈 Investing & Stocks" },
  { value: "Entrepreneurship", label: "🚀 Entrepreneurship" },
  { value: "Real Estate", label: "🏠 Real Estate" },
  { value: "Crypto & Web3", label: "₿ Crypto & Web3" },
  { value: "Side Hustles", label: "💼 Side Hustles" },
  { value: "Business Strategy", label: "♟️ Business Strategy" },
  { value: "Wealth Mindset", label: "🧠 Wealth Mindset" },
  { value: "Financial Freedom", label: "🌍 Financial Freedom" },
  { value: "Passive Income", label: "💤 Passive Income" },
  { value: "History", label: "🏛️ History" },
  { value: "Ancient Civilisations", label: "🗿 Ancient Civilisations" },
  { value: "War & Military History", label: "⚔️ War & Military History" },
  { value: "Mysteries & Conspiracies", label: "🔍 Mysteries & Conspiracies" },
  { value: "Technology & AI", label: "🤖 Technology & AI" },
  { value: "Science & Space", label: "🚀 Science & Space" },
  { value: "Tech Business", label: "💻 Tech Business" },
] as const;

export const FINANCE_DOC_STYLE_OPTIONS = [
  { value: "Dark Luxury", label: "🖤 Dark Luxury — premium black & gold aesthetic" },
  { value: "Clean Minimal", label: "⬜ Clean Minimal — white, sharp, professional" },
  { value: "Cinematic Dramatic", label: "🎬 Cinematic Dramatic — moody, high contrast" },
  { value: "Bold Modern", label: "⚡ Bold Modern — vibrant, energetic" },
] as const;

export const FINANCE_DOC_TONE_OPTIONS = [
  { value: "Documentary", label: "🎙️ Documentary — authoritative narrator" },
  { value: "Educational", label: "📚 Educational — clear & informative" },
  { value: "Motivational", label: "🔥 Motivational — inspiring & energetic" },
  { value: "Investigative", label: "🔍 Investigative — revealing hidden truths" },
] as const;

export const FINANCE_DOC_LENGTH_OPTIONS = [
  { value: "mini",     label: "Short · 30 scenes · ~8 min" },
  { value: "short",    label: "Quick · 75 scenes · ~21 min" },
  { value: "medium",   label: "Standard · 150 scenes · ~42 min" },
  { value: "long",     label: "Extended · 250 scenes · ~70 min" },
  { value: "epic",     label: "Full-Length · 400 scenes · ~110 min" },
] as const;

export const FINANCE_DOC_TOPIC_SUGGESTIONS: Record<string, string[]> = {
  "Personal Finance": [
    "The 50/30/20 rule that changed how I handle money",
    "Why most people never build wealth (and how to fix it)",
    "The hidden cost of your daily habits on your net worth",
    "How to go from £0 savings to a 6-month emergency fund",
    "The 5 money mistakes keeping you broke in your 20s",
  ],
  "Investing & Stocks": [
    "How index funds quietly make millionaires",
    "Warren Buffett's secret that Wall Street doesn't want you to know",
    "The truth about compound interest that schools never taught you",
    "Why timing the market always loses to time in the market",
    "How to build a £100k portfolio starting with £50/month",
  ],
  "Entrepreneurship": [
    "The business model that made 1000 people millionaires last year",
    "Why 90% of businesses fail in year one (and how to be the 10%)",
    "How to start a business with £0 and scale to 6 figures",
    "The faceless brand strategy outperforming personal brands right now",
    "What nobody tells you about running a business alone",
  ],
  "Side Hustles": [
    "5 side hustles that actually pay life-changing money",
    "How I built a £5k/month income stream without showing my face",
    "The digital product business model anyone can start today",
    "Why content creation is the most underrated business in 2025",
    "From 9–5 to financial freedom: the realistic roadmap",
  ],
  "Passive Income": [
    "7 passive income streams ranked by effort vs reward",
    "How to make money while you sleep (the real way)",
    "The truth about passive income that gurus won't tell you",
    "How to turn one skill into multiple income streams",
    "Building digital assets that pay you forever",
  ],
  "History": [
    "The ancient civilisation that was 1000 years ahead of its time",
    "The forgotten empire that ruled half the world",
    "The real story behind the most famous event in history",
    "The secret society that shaped the modern world",
    "The historical figure who changed everything — and was erased from the books",
  ],
  "Ancient Civilisations": [
    "The mystery of how the pyramids were actually built",
    "The lost city that archaeologists still cannot explain",
    "The ancient technology that scientists are only now understanding",
    "How Rome really fell — and why it matters today",
    "The civilisation that vanished overnight with no explanation",
  ],
  "War & Military History": [
    "The battle that changed the course of human history",
    "The secret operation that won World War II",
    "The soldier who fought alone for 30 years not knowing the war was over",
    "The deadliest day in military history nobody talks about",
    "The weapon so powerful it was immediately destroyed after use",
  ],
  "Mysteries & Conspiracies": [
    "The disappearance that has never been solved",
    "The government secret that was hidden for 50 years",
    "The unsolved mystery that baffles scientists to this day",
    "The conspiracy theory that turned out to be completely true",
    "The event so strange that even experts cannot explain it",
  ],
  "Technology & AI": [
    "How AI is quietly taking over jobs nobody expected",
    "The technology that will make smartphones obsolete by 2030",
    "Why every major tech company is terrified of this one breakthrough",
    "The dark side of social media algorithms nobody is talking about",
    "How AI will change what it means to be human",
  ],
  "Science & Space": [
    "The discovery that proves we are not alone in the universe",
    "The science experiment so dangerous it was shut down immediately",
    "What NASA found on Mars that they refused to release for 10 years",
    "The black hole that broke every rule of physics",
    "The scientist who was laughed at — then proved everyone wrong",
  ],
  "Tech Business": [
    "How a college dropout built a £1 trillion company",
    "The startup that killed an entire industry overnight",
    "Why Silicon Valley is terrified of this new technology",
    "The billion dollar idea that was stolen — and the real story behind it",
    "How one algorithm change made 10,000 businesses go bankrupt",
  ],
};

export const FINANCE_DOC_HOOK_OPTIONS = [
  { value: "shocking_stat", label: "Shocking statistic opener" },
  { value: "contrarian", label: "Contrarian take (\"Everything you know is wrong\")" },
  { value: "story", label: "Story-led (\"In 2020, one decision changed everything...\")" },
  { value: "question", label: "Direct question (\"Why are 80% of people still broke?\")" },
  { value: "reveal", label: "Big reveal (\"The truth about X that banks hide\")" },
] as const;

export const FINANCE_DOC_CTA_OPTIONS = [
  { value: "subscribe", label: "Subscribe for more (grow channel)" },
  { value: "affiliate", label: "💰 Referral / Affiliate link (earn per signup)" },
  { value: "sell_product", label: "Sell digital product" },
  { value: "email_list", label: "Join email list / free resource" },
  { value: "comment", label: "Drive comments (boost algorithm)" },
] as const;

export const FINANCE_DOC_AFFILIATE_PLATFORMS = [
  { value: "trading212", label: "Trading 212 (free share on signup)" },
  { value: "freetrade", label: "Freetrade (free share on signup)" },
  { value: "etoro", label: "eToro (copy trading platform)" },
  { value: "coinbase", label: "Coinbase (crypto - earn on signup)" },
  { value: "revolut", label: "Revolut (premium banking)" },
  { value: "moneyfarm", label: "Moneyfarm (investment management)" },
  { value: "wealthify", label: "Wealthify (ethical investing)" },
  { value: "moneybox", label: "Moneybox (round-up investing app)" },
  { value: "other", label: "Other (I'll type the name)" },
] as const;

export const OPENING_HOOK_STYLE_PRESETS = [
  { value: "Stop scrolling: this changes everything.", label: "Pattern interrupt" },
  { value: "You are making this wrong - here is the fix.", label: "Contrarian take" },
  { value: "I tested this so you do not waste time.", label: "Tested-for-you" },
  { value: "Watch this transformation in under 30 seconds.", label: "Transformation" },
  { value: "Do this before your next build.", label: "Action command" },
  { value: "One tiny tweak made this look 10x better.", label: "Curiosity gap" },
  { value: "Most people skip this step. Do not.", label: "Mistake warning" },
  { value: "If you want premium results, start here.", label: "Premium result promise" },
  { value: "This smells illegal until you taste it.", label: "Bold sensory tease" },
  { value: "I almost gave up on this dish—then I fixed one thing.", label: "Honest struggle hook" },
  { value: "No viral music, just the sound of this working.", label: "Anti-trend calm" },
  { value: "Save this before the algorithm hides it.", label: "FOMO soft" },
  { value: "Restaurant trick, home kitchen budget.", label: "Value flip" },
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
