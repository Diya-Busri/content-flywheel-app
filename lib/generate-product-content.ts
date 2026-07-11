import OpenAI from "openai";
import { cleanProductTitle } from "./product-title";
import { withRetry429 } from "./openai-with-retry";

export type GenerateContentSection = { id: string; title: string; body: string; imagePrompt?: string };

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/** Customization from Discovery step. Kept within limits for generation speed (<60s target). */
export type CustomizationOptions = {
  numChapters?: number;
  contentLength?: "short" | "medium" | "long";
  contentStyle?: "text_only" | "text_with_placeholders" | "text_with_ai_images";
  tone?: "professional" | "casual" | "academic" | "friendly";
  ebookGuide?: { includeToc?: boolean; includeIntroConclusion?: boolean };
  workbook?: { exercisesPerSection?: number; includeAnswerKey?: boolean; includeFillInBlanks?: boolean };
  checklist?: { numChecklists?: number; itemsPerChecklist?: number; includeProgressTracking?: boolean };
  course?: { numModules?: number; lessonsPerModule?: number; includeLearningObjectives?: boolean; includeAssignments?: boolean };
  journal?: { numPrompts?: number; includeLinedSpace?: boolean; includeReflectionQuestions?: boolean };
  planner?: { duration?: string; includeGoalSetting?: boolean; includeHabitTracker?: boolean };
  spreadsheet?: { numTutorials?: number; difficulty?: string; includePracticeExercises?: boolean };
  notion?: { numDatabases?: number; includeSetupInstructions?: boolean };
  cookbook?: {
    numRecipes?: number;
    country?: string;               // e.g. "UK", "US", "Australia"
    measurementSystem?: "metric" | "imperial";
    dietaryFocus?: string;          // e.g. "gluten-free", "high-protein", "budget"
    includeCostEstimates?: boolean;
    includePrintablePlanner?: boolean;
  };
};

/** Sensible limits so generation stays under ~60s. Default 5 chapters, medium ~800 words. */
const DEFAULT_CHAPTERS = 5;
const MAX_CHAPTERS = 9;
const MAX_PLANNER_SECTIONS = 7;
const MAX_SECTION_TOKENS = 2500;

// ─── Cookbook-specific constants ────────────────────────────────────────────────
const COOKBOOK_MIN_RECIPES = 8;
const COOKBOOK_DEFAULT_RECIPES = 18;
const COOKBOOK_MAX_RECIPES = 30;
const COOKBOOK_RECIPE_TOKENS = 2000; // recipes need more tokens for full structure

export type GenerateProductContentParams = {
  productName: string;
  productDescription?: string;
  productIncluded?: string;
  productWhy?: string;
  niche: string;
  format: string;
  /** When set (e.g. in a bundle), focus this product on a specific angle of the niche to avoid repetition. */
  subFocus?: string;
  hookTexts: string[];
  ctaTexts: string[];
  customizationOptions?: CustomizationOptions;
  /** Bundle mode: generate a shorter product (fewer sections) to keep generation fast when 8 run in parallel. */
  bundleMode?: boolean;
  /** Creator's own expertise, methodology, or unique angle — injected to personalise output beyond generic AI. */
  creatorExpertise?: string;
};

// ─── Quality-focused system prompt ───────────────────────────────────────────────
// INTENTIONAL: removed "fill full pages" and "meet minimum word count" — those incentivise
// padding and repetition. Quality and specificity are the real metrics.
const SYSTEM_PREMIUM =
  "You are an expert digital product creator. Your content must be specific, practical, and genuinely valuable — the kind of content customers would pay for and use repeatedly. QUALITY over quantity: one specific, actionable example is worth more than five generic paragraphs. Each section must deliver a NEW outcome, tool, resource, or skill not covered elsewhere in the product. Write like a knowledgeable expert who cuts to the chase — not a generic AI assistant trying to fill space. Return only valid JSON with a 'sections' array. Output HTML only in body fields — no markdown, no code fences, no explanation.";

// ─── Anti-cliché rules injected into all general-content prompts ─────────────────
const ANTI_CLICHE_BLOCK = `
BANNED PHRASES — these make content feel generic and AI-generated. Never use them:
• "In today's fast-paced world" / "In our busy modern lives" / "In today's digital age"
• "As a busy parent" / "As a busy professional" / "For busy people like you"
• "Look no further" / "You've come to the right place" / "You're not alone"
• "This comprehensive guide" / "This ultimate guide" / "This step-by-step guide"
• "Embark on your journey" / "Begin your journey" / "Start your journey"
• "Transform your life/business/experience" / "Game-changer" / "Revolutionary"
• "Unlock your potential" / "Take your X to the next level" / "Level up"
• "Studies show" / "Research suggests" / "Experts say" — unless citing a real, specific source
• "Many people find that" / "As we all know" / "It goes without saying" / "Needless to say"
• "Without further ado" / "That being said" / "With that in mind"

REQUIRED VARIETY — each section must:
• Cover a GENUINELY DIFFERENT topic, tool, or skill than every other section
• Open differently (rotate: question, specific example, scenario, data point, tip, contrast)
• Not repeat the same core problem statement or benefit message already covered elsewhere

NO INVENTED CONTENT:
• Do NOT invent fictional case studies, fake testimonials, or made-up families/people ("Sarah found that...")
• Do NOT cite statistics or research you cannot verify — replace with concrete practical examples
• Do NOT pad with "In this section we covered..." or "As mentioned earlier..."`;

// ─── Recipe card system prompt ────────────────────────────────────────────────────
const RECIPE_CARD_SYSTEM =
  "You write complete, ready-to-cook recipes for digital cookbooks. Every recipe must have exact measurements (grams/ml/Celsius for UK), specific step-by-step method, realistic cost estimates, storage instructions, dietary notes, and substitutions. Never use vague instructions like 'cook until ready' or ingredient amounts like 'some' or 'a handful'. Return only valid JSON with a body field containing clean HTML.";

// ─── Context block ────────────────────────────────────────────────────────────────
const CONTEXT_BLOCK = (params: GenerateProductContentParams) =>
  `PRODUCT CONTEXT:
- Name: "${params.productName}"
- What's included: ${params.productIncluded || "N/A"}
- Why it sells / audience: ${params.productWhy || "N/A"}
${params.productDescription ? `- Description: ${params.productDescription}` : ""}
${params.creatorExpertise ? `CREATOR EXPERTISE & UNIQUE ANGLE (weave this into the content so it reflects their voice, not generic AI output): "${params.creatorExpertise}"` : ""}
NICHE: ${params.niche || "General audience"}
${params.subFocus ? `SUB-FOCUS (this product must cover ONLY this angle; do not repeat the same content as other products): ${params.subFocus}` : ""}
${params.hookTexts?.length ? `HOOKS (weave into content naturally): ${params.hookTexts.join(" | ")}` : ""}
${params.ctaTexts?.length ? `CTAs: ${params.ctaTexts.join(" | ")}` : ""}
${params.customizationOptions?.tone ? `TONE: Write in a ${params.customizationOptions.tone} tone throughout.` : ""}`;

const SELLABLE_STRUCTURE = `
SELLABLE CONTENT (include these sections in this order):
1. outcome-promise: 2–3 paragraphs. A compelling intro that clearly states what the reader will ACHIEVE. Be transformational, not just informational. Focus on specific outcomes and transformation.
2. fast-start: Title exactly "Quick Wins: 3 Things You Can Do Today". Body: 3 immediate, actionable steps the reader can do in under 30 minutes. Use <ol> or clear numbered items.
3. framework: A simple branded model buyers can use (e.g. "The 3-Step PREP Method"). Title = the framework name. Body: one short paragraph + 3–5 pillars with one line each.
4. [your main chapters/sections...]
5. disclaimer: One short paragraph. Empowerment statement that builds trust (e.g. "This guide is for educational purposes. You are responsible for your own decisions. Use it as a springboard to take action.").`;

const CHAPTER_TITLES_RULE = `
CHAPTER/SECTION TITLES: Use benefit-driven, outcome-focused titles. Every title should promise a specific transformation or actionable skill — not just label a topic.`;

const htmlRules = `OUTPUT RULES: Return body as clean HTML only. Use <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li>. No markdown (** or ##).`;

// ─── Normalize format string ──────────────────────────────────────────────────────
function normalizeFormat(format: string | undefined): string {
  if (!format || typeof format !== "string") return "ebook";
  const lower = format.toLowerCase().trim();
  if (lower === "course outline" || lower === "course_outline") return "course";
  if (lower === "checklist pack") return "checklist";
  if (lower === "notion template" || lower === "notion_template") return "notion";
  if (lower === "notebook") return "planner";
  if (lower === "cookbook" || lower === "recipe book" || lower === "recipe-book" || lower === "recipe" || lower === "recipe pack") return "cookbook";
  return lower;
}

// ─── buildPrompt (legacy single-call path — still used by generateProductContent) ─
function buildPrompt(params: GenerateProductContentParams): { prompt: string; useGpt4: boolean; maxTokens: number } {
  const { productName, format = "ebook", niche } = params;
  const subTopic = params.subFocus?.trim() || niche || "the topic";
  const normalizedFormat = normalizeFormat(format);
  const ctx = CONTEXT_BLOCK(params);

  if (normalizedFormat === "cookbook") {
    const numRecipes = params.bundleMode ? 10
      : (params.customizationOptions?.cookbook?.numRecipes
        ?? (params.customizationOptions?.contentLength === "short" ? 12
          : params.customizationOptions?.contentLength === "long" ? 25 : 18));
    const country = params.customizationOptions?.cookbook?.country ?? "UK";
    const measurements = params.customizationOptions?.cookbook?.measurementSystem ?? "metric";
    return {
      useGpt4: true,
      maxTokens: params.bundleMode ? 12000 : 24000,
      prompt: `Create a COOKBOOK/RECIPE BOOK titled "${productName}" for the ${niche} niche.

Generate ${numRecipes} complete, ready-to-cook recipes. Each recipe MUST include:
- Recipe title and 2–3 sentence description
- Servings, prep time, cook time, total time
- Ingredients with EXACT quantities (${measurements === "metric" ? "grams/ml" : "cups/oz"}, ${country === "UK" ? "Celsius" : "Fahrenheit"})
- Step-by-step method (5–8 specific steps — not vague instructions)
- Storage instructions with specific times
- Dietary information and main allergens
- 2–3 ingredient substitutions
- Estimated cost per serving (realistic ${country} supermarket prices)
- One practical tip

${ctx}

${ANTI_CLICHE_BLOCK}

STRUCTURE:
- how-to-use: Brief intro (200 words max — practical, not motivational)
- pantry-essentials: Categorised list of staple ingredients
- recipe-1 through recipe-${numRecipes}: One recipe per section (DIFFERENT recipes — varied proteins, meal types, occasions)
- meal-plan: 7-day meal plan table using the recipes
- shopping-list: Organised by supermarket aisle category
- substitutions: Dietary substitution guide (gluten-free, dairy-free, vegetarian, budget)
- leftover-guide: 6–8 leftover repurposing ideas
- final-page: Brief author/brand closing page

Use HTML recipe card structure with <div class="recipe-card">, <div class="recipe-meta">, <div class="recipe-notes">. No fictional case studies or made-up testimonials.

Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "ebook") {
    return {
      useGpt4: true,
      maxTokens: params.bundleMode ? 10000 : 16000,
      prompt: `Create an EBOOK titled "${productName}" for the ${niche} niche.

Write a fully prose-based ebook on ${subTopic}. ${params.bundleMode ? "4–5 chapters" : "6–8 chapters"}. Each chapter has: title, opening with a specific scenario or example (not a generic statement), 3–4 subheadings with written content, one practical worked example, and a chapter summary with 3 action points. No fill-in sections. No checklists. Pure educational reading content.

CRITICAL: Each chapter must cover a DIFFERENT aspect — do not repeat the same problem, benefit, or advice across chapters.

${ctx}
${ANTI_CLICHE_BLOCK}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

Use <h2>, <h3> for chapters and subheadings. Use <p> for paragraphs. You may use <div class="callout"> for key tips. No workbook fill-ins. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. ${htmlRules} No markdown.`,
    };
  }

  if (normalizedFormat === "workbook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a WORKBOOK titled "${productName}" for the ${niche} niche.

Write a chapter-based workbook on ${subTopic}. 5–6 chapters. Each chapter must follow this exact structure: (1) Chapter title + 2-paragraph teaching intro explaining the concept with a specific example, (2) Core lesson — 3–4 paragraphs going deeper with a worked example, (3) 3 exercises directly based on that chapter's content with clear instructions and fill-in response lines, (4) 3 reflection questions linking the chapter to the reader's specific situation, (5) Chapter summary and key takeaway. Exercises must relate directly to the chapter content, never generic.

Each chapter covers a DIFFERENT skill or outcome — not variations on the same theme.

${ctx}
${ANTI_CLICHE_BLOCK}

Use <div class="writing-space"> with ___ or blank lines for written responses. Sections: outcome-promise, fast-start, framework, intro, then ch1–ch5 (or ch6), disclaimer. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. Body = HTML with writing-space divs. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "guide") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a GUIDE titled "${productName}" for the ${niche} niche.

Write a practical how-to guide on ${subTopic}. Structure: introduction explaining the problem this guide solves (with a specific scenario, not generic statement), 5–7 numbered steps or sections each with a title, clear explanation, and concrete worked example (not an invented case study), a quick reference summary section at the end. Conversational tone. Action-focused.

Each step covers a DIFFERENT action or skill — do not repeat the same advice in different words.

${ctx}
${ANTI_CLICHE_BLOCK}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

Each step: <h2>Step N: Title</h2>, explanation, concrete example. ${htmlRules} Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}.`,
    };
  }

  if (normalizedFormat === "spreadsheet") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Generate a SPREADSHEET TUTORIAL titled "${productName}" for the ${niche} niche.

Generate a practical spreadsheet tutorial on ${subTopic}. Include: what the spreadsheet tracks and why, step-by-step setup instructions with actual column names, real formula examples like =AVERAGE(), =COUNTIF(), =IF() relevant to the topic, conditional formatting rules, 3 example use cases with realistic sample data, and a tips/troubleshooting section.

${ctx}

Write in tutorial format. Use HTML: <h2>, <h3>, <p>, <ul>, <ol>, <strong>. Include "imagePrompt" for each section. Return 4–8 sections as valid JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. ${htmlRules} No markdown.`,
    };
  }

  if (normalizedFormat === "notion") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a NOTION TEMPLATE for "${productName}" (${niche} niche).

Generate a Notion template for ${subTopic}. Include: template name and purpose, all pages and databases with their exact property names and types (text, select, multi-select, date, checkbox, number, relation), how pages link together, 3–5 realistic sample entries showing real data, and step-by-step usage instructions.

${ctx}

Sections: outcome-promise, fast-start, framework, template-overview, pages-databases, sample-entries, usage-instructions, disclaimer. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "checklist" || normalizedFormat === "checklist pack") {
    return {
      useGpt4: true,
      maxTokens: 8000,
      prompt: `Create a CHECKLIST PACK for "${productName}" (${niche} niche).

Generate 6 standalone checklists on ${subTopic}. Each checklist has: a unique title targeting a specific situation, one sentence of context, 15–20 checkbox items that are concrete actions not vague concepts. No long explanations. Each item must be immediately actionable. All 6 checklists must cover DIFFERENT situations.

${ctx}

Use <ul class="checklist"><li>☐ Action item.</li></ul>. Sections: outcome-promise, fast-start, framework, check1–check6, disclaimer. Each check section: unique title, one sentence context, then 15–20 ☐ items. No prose. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "journal") {
    return {
      useGpt4: true,
      maxTokens: params.bundleMode ? 8000 : 14000,
      prompt: params.bundleMode
        ? `Create a JOURNAL titled "${productName}" for the ${niche} niche.

Generate a guided journal on ${subTopic}. Include: a brief welcome section, 7 daily journal entries (Day 1–7) each with a UNIQUE prompt specific to ${subTopic} (no two prompts the same), and a weekly reflection page. Include fill-in lines throughout.

${ctx}

Sections: outcome-promise, fast-start, framework, welcome, daily1–daily7, weekly-reflection, disclaimer. Use <div class="writing-space"> and ___ for fill-in lines. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`
        : `Create a JOURNAL titled "${productName}" for the ${niche} niche.

Generate a guided journal on ${subTopic}. Include: a brief welcome/how to use section, 30 daily journal entries each with a UNIQUE prompt (specific to ${subTopic} — no two prompts can repeat the same theme), a weekly reflection page every 7 days with 4–5 deeper questions, and a monthly review page. Include fill-in lines throughout.

${ctx}

Sections: outcome-promise, fast-start, framework, welcome, daily1–daily30 (or grouped), weekly-reflection pages, monthly-review, disclaimer. Use <div class="writing-space"> and ___ for fill-in lines. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "planner" || normalizedFormat === "notebook") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a PLANNER titled "${productName}" for the ${niche} niche.

Generate a planner focused on ${subTopic}. Include: monthly overview table (weeks, focus area, top 3 goals, mood/progress tracker, notes), weekly spread (7 days with morning/midday/evening blocks), daily task page (top 3 priorities, to-do list, time blocks, progress tracker), habit tracker grid (30 days), and monthly reflection page. Mostly tables and grids. Minimal prose.

${ctx}

Sections: outcome-promise, fast-start, framework, monthly-overview, weekly-spread, daily-task-page, habit-tracker, monthly-reflection, disclaimer. Use <table> for grids, ___ or [FILL IN] for user input. No explanatory paragraphs. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "course" || normalizedFormat === "course outline") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a COURSE OUTLINE titled "${productName}" for the ${niche} niche.

Generate a structured course outline on ${subTopic}. Include: course title, learning objectives, 4–5 modules each with a module title, description, 4–5 lesson titles with one-line descriptions, and key takeaways. Format like a curriculum document. Each module covers a DIFFERENT skill or stage of learning.

${ctx}

Each module = <h2>Module N: Title</h2>, short description, <h3>Learning objectives</h3><ul>...</ul>, <h3>Lessons</h3><ol><li>Lesson title: one-line description.</li></ol>, <h3>Key takeaways</h3>. Sections: outcome-promise, fast-start, framework, mod1–mod5, disclaimer. Add "imagePrompt" per module. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. ${htmlRules}`,
    };
  }

  // Default: ebook-style
  return {
    useGpt4: true,
    maxTokens: 16000,
    prompt: `Generate full CONTENT for "${productName}" (${niche} niche). Format: ${format}. Focus on: ${subTopic}.

Premium content users will pay $37–97 for. Make it specific, practical, and unique per section.
${ctx}
${ANTI_CLICHE_BLOCK}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

Each section must deliver a DIFFERENT outcome or tool. Include specific examples, worked scenarios, and action items. No invented case studies. No padding.

Sections order: outcome-promise, fast-start, framework, then main sections (section-1, section-2, ...), then disclaimer.

IMAGE PROMPTS: For each main section, add "imagePrompt": a 1-sentence DALL-E prompt for a relevant professional illustration.

Return ONLY JSON: {"sections":[{"id","title","body","imagePrompt"?}]}. ${htmlRules}`,
  };
}

export async function generateProductContent(params: GenerateProductContentParams): Promise<GenerateContentSection[]> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const productName = cleanProductTitle(params.productName) || params.productName || "Product";
  const paramsWithCleanTitle = { ...params, productName };
  const { prompt, maxTokens } = buildPrompt(paramsWithCleanTitle);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PREMIUM },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonStr) as { sections?: Array<{ id?: string; title?: string; body?: string; imagePrompt?: string }> };
  const sections: GenerateContentSection[] = (parsed.sections || []).map((s, i) => ({
    id: typeof s.id === "string" && s.id ? s.id : `section-${i + 1}`,
    title: typeof s.title === "string" && s.title ? s.title : `Section ${i + 1}`,
    body: typeof s.body === "string" ? s.body : "",
    imagePrompt: typeof s.imagePrompt === "string" && s.imagePrompt.trim() ? s.imagePrompt.trim() : undefined,
  }));

  if (sections.length === 0) throw new Error("AI returned no sections");
  return sections;
}

/** Outline only: section id + title. Used for incremental generation to avoid timeouts. */
export type OutlineSection = { id: string; title: string };

export async function generateProductOutline(params: GenerateProductContentParams): Promise<OutlineSection[]> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const { productName, format = "ebook", niche, customizationOptions } = params;
  const normalizedFormat = normalizeFormat(format);
  const ctx = CONTEXT_BLOCK(params);
  const rawChapters = customizationOptions?.numChapters ?? DEFAULT_CHAPTERS;
  const numChapters = Math.min(MAX_CHAPTERS, Math.max(3, Number(rawChapters) || DEFAULT_CHAPTERS));

  const journalPrompts = Math.min(15, Math.max(5, customizationOptions?.journal?.numPrompts ?? 12));
  const courseModules = Math.min(MAX_CHAPTERS, Math.max(2, customizationOptions?.course?.numModules ?? numChapters));
  const numChecklists = Math.min(5, Math.max(2, customizationOptions?.checklist?.numChecklists ?? 4));
  const numTutorials = Math.min(5, Math.max(2, customizationOptions?.spreadsheet?.numTutorials ?? 4));
  const numDatabases = Math.min(5, Math.max(2, customizationOptions?.notion?.numDatabases ?? 4));

  // Cookbook recipe count
  const rawRecipeCount = customizationOptions?.cookbook?.numRecipes
    ?? (customizationOptions?.contentLength === "short" ? 12
      : customizationOptions?.contentLength === "long" ? 25 : COOKBOOK_DEFAULT_RECIPES);
  const numRecipes = Math.min(COOKBOOK_MAX_RECIPES, Math.max(COOKBOOK_MIN_RECIPES, rawRecipeCount));

  const country = customizationOptions?.cookbook?.country ?? "UK";
  const dietaryFocus = customizationOptions?.cookbook?.dietaryFocus ?? "";
  const niche_or_focus = params.subFocus?.trim() || niche || "the topic";

  // Format-specific structure
  let sectionCountHint: string;
  let formatStructureNote: string;

  switch (normalizedFormat) {
    case "cookbook": {
      const recipeIds = Array.from({ length: numRecipes }, (_, i) => `recipe-${i + 1}`).join(", ");
      const includePlanner = customizationOptions?.cookbook?.includePrintablePlanner !== false;
      sectionCountHint = `how-to-use, pantry-essentials, ${recipeIds}, meal-plan, shopping-list, substitutions, leftover-guide${includePlanner ? ", printable-planner" : ""}, final-page`;
      formatStructureNote = `COOKBOOK/RECIPE BOOK: Generate a practical, sellable cookbook with exactly ${numRecipes} complete recipes.

Structure:
1. "how-to-use" — Brief intro on how to use the cookbook (practical, not motivational)
2. "pantry-essentials" — Categorised pantry staple list
3. recipe-1 through recipe-${numRecipes} — Each section MUST have a specific, appetising recipe TITLE (not generic names like "Quick Meal" or "Easy Dinner"). Examples of good titles: "20-Minute Lemon Garlic Chicken", "One-Pot Chickpea Curry", "Sheet Pan Sausages & Root Veg", "Quick Fish Tacos", "Creamy Tomato Pasta in 15 Minutes". Vary the recipes: different proteins, cooking methods, meal occasions, prep times. ${dietaryFocus ? `All recipes should be ${dietaryFocus}.` : ""} Cover breakfasts, lunches, dinners, and at least 1-2 snacks/sides if fitting.
4. "meal-plan" — 7-day meal plan using the recipes
5. "shopping-list" — Organised by supermarket aisle
6. "substitutions" — Dietary substitution guide
7. "leftover-guide" — Leftover repurposing ideas
${includePlanner ? `8. "printable-planner" — Blank printable meal planner` : ""}
${includePlanner ? `9.` : `8.`} "final-page" — Brief closing/author page

IMPORTANT for recipe titles: Be specific, varied, and appetising. A ${country} ${niche_or_focus} cookbook should have real recipe names that make someone want to cook them immediately. No duplicates.`;
      break;
    }

    case "ebook":
    case "guide":
      sectionCountHint = `outcome-promise, fast-start, framework, intro, ${numChapters} chapters (ch1–ch${numChapters}), disclaimer`;
      formatStructureNote = `EBOOK/GUIDE: 20–80 pages. Structure: intro, chapters with step-by-step learning, examples, case study, summary, CTA. Teaching/explanatory tone.

CRITICAL — each chapter title must cover a COMPLETELY DIFFERENT skill, outcome, or tool:
❌ Bad (repetitive): "Why Quick Meals Matter", "The Importance of Family Dinners", "Why Busy Parents Need Easy Recipes"
✅ Good (unique): "20 Weeknight Recipes", "The Batch Cooking System", "Meal Planning in 30 Minutes"

Chapter titles must be specific benefit-driven outcomes, not topic labels.`;
      break;

    case "workbook":
      sectionCountHint = `outcome-promise, fast-start, framework, intro, ${Math.min(8, Math.max(4, numChapters))} prompt/writing sections (ch1–ch${Math.min(8, Math.max(4, numChapters))}), disclaimer`;
      formatStructureNote = "WORKBOOK: 15–40 pages. Structure: brief explanation, prompt pages, blank writing spaces, fill-in fields. Minimal theory. Each chapter covers a DIFFERENT skill or exercise — not variations on the same theme.";
      break;

    case "notion":
      sectionCountHint = "outcome-promise, fast-start, framework, template-overview, pages-databases, sample-entries, usage-instructions, disclaimer";
      formatStructureNote = "NOTION TEMPLATE: Template name and purpose, all pages and databases with property names and types, how pages link, 3–5 sample entries, step-by-step usage instructions.";
      break;

    case "checklist":
      sectionCountHint = `outcome-promise, fast-start, framework, check1–check6, disclaimer`;
      formatStructureNote = "CHECKLIST PACK: 6 standalone checklists. Each has a unique title targeting a DIFFERENT specific situation, one sentence context, 15–20 checkbox action items. No long explanations. All 6 must be genuinely different.";
      break;

    case "journal":
      sectionCountHint = `outcome-promise, fast-start, framework, welcome, daily1–daily30 (with weekly1–weekly4 between them), monthly-review, disclaimer`;
      formatStructureNote = "JOURNAL: Welcome/how to use, 30 daily entry sections (daily1–daily30), 4 weekly reflection sections (weekly1–weekly4 interspersed), monthly-review. Prompts specific to sub-topic. EACH prompt must be unique — no two prompts can repeat the same theme.";
      break;

    case "planner":
      sectionCountHint = "outcome-promise, fast-start, framework, monthly-overview, weekly-spread, daily-task-page, habit-tracker, monthly-reflection, disclaimer";
      formatStructureNote = "PLANNER: Monthly overview table, weekly spread (7 days, morning/midday/evening), daily task page, habit tracker grid (30 days), monthly reflection. Mostly tables and grids. Minimal prose.";
      break;

    case "course":
      sectionCountHint = `outcome-promise, fast-start, framework, ${courseModules} modules (mod1–mod${courseModules}), disclaimer`;
      formatStructureNote = "COURSE OUTLINE: modules with lessons — each module covers a different stage or skill.";
      break;

    case "spreadsheet": {
      const numTrackerTabs = params.bundleMode ? 3
        : customizationOptions?.contentLength === "short" ? 3
        : customizationOptions?.contentLength === "long"  ? 5 : 4;
      const tabIds = Array.from({ length: numTrackerTabs }, (_, i) => `tracker-tab-${i + 1}`).join(", ");
      sectionCountHint = `getting-started, ${tabIds}, disclaimer`;
      formatStructureNote = `SPREADSHEET TEMPLATE (downloadable XLSX file — customers use this daily in Excel or Google Sheets):

This product is a WORKING SPREADSHEET TRACKER, not an ebook. Generate ${numTrackerTabs} named tracker tabs specifically for: "${productName}" (${niche}).

REQUIRED STRUCTURE:
1. "getting-started" — title exactly "Getting Started" — brief setup text (150 words max)
2. tracker-tab-1 through tracker-tab-${numTrackerTabs} — Each section = ONE named Excel tab. The title MUST be the EXACT TAB NAME customers will see in Excel (2-4 words). Based on "${productName}", decide what data they need to track and name each tab specifically. Good examples: "Income Tracker", "Monthly Expenses", "Budget Overview", "Bills & Subscriptions", "Savings Goals", "Debt Log", "Net Worth". BAD examples: "Tab 1", "Data", "Tracker".
3. "disclaimer" — title exactly "Disclaimer" — one sentence: "For educational purposes only."

All ${numTrackerTabs} tabs must track DIFFERENT data — no two tabs should overlap.`;
      break;
    }

    default:
      sectionCountHint = `outcome-promise, fast-start, framework, intro, ${numChapters} sections (section-1–section-${numChapters}), disclaimer`;
      formatStructureNote = "Standard sections. Each section covers a DIFFERENT topic or skill.";
  }

  const formatExplicit =
    normalizedFormat === "cookbook"
      ? `COOKBOOK = how-to-use, pantry-essentials, recipe-1 through recipe-${numRecipes} (REAL recipe titles), meal-plan, shopping-list, substitutions, leftover-guide, printable-planner, final-page.`
      : normalizedFormat === "workbook"
        ? "WORKBOOK = intro + prompt/writing sections (ch1, ch2 or prompt1, prompt2)."
        : normalizedFormat === "ebook" || normalizedFormat === "guide"
          ? "EBOOK/GUIDE = intro + chapters (ch1, ch2...). Teaching tone. Each chapter DIFFERENT topic."
          : normalizedFormat === "planner"
            ? "PLANNER = monthly-overview, weekly-breakdown, task-section, goal-tracker, progress-tracker. No chapters."
            : normalizedFormat === "journal"
              ? "JOURNAL = daily pages (daily1, daily2...). Each with unique prompts."
              : normalizedFormat === "checklist"
                ? "CHECKLIST = check1, check2... Tick boxes only. Each checklist targets DIFFERENT situation."
                : normalizedFormat === "notion"
                  ? "NOTION = dashboard, calendar-view, table-view, revenue-tracker, weekly-planning."
                  : normalizedFormat === "course"
                    ? "COURSE = mod1, mod2... Modules with lessons. Each module different skill."
                    : normalizedFormat === "spreadsheet"
                      ? `SPREADSHEET = getting-started (title: "Getting Started") + tracker tab sections with REAL descriptive names (e.g. "Income Tracker", "Monthly Expenses", "Budget Overview") + disclaimer (title: "Disclaimer"). Each tab title = what users see in Excel.`
                      : "";

  const prompt = `Product: "${productName}". Niche: ${niche}.
${ctx}

SELECTED FORMAT: "${normalizedFormat}". You MUST use ONLY the structure for this format.
${formatExplicit}

${formatStructureNote}

Return ONLY a JSON object with a "sections" array. Each item: {"id": "string", "title": "string"}. No body, no imagePrompt.
Generate exactly these sections in order: ${sectionCountHint}
${(normalizedFormat === "ebook" || normalizedFormat === "guide" || normalizedFormat === "workbook")
    ? `CRITICAL: Exactly ${numChapters} main chapter/section(s) (ch1–ch${numChapters}). Each chapter title must describe a UNIQUE, SPECIFIC outcome or skill — not variations on the same theme.`
    : normalizedFormat === "cookbook"
      ? `CRITICAL: Include exactly ${numRecipes} recipe sections (recipe-1 through recipe-${numRecipes}). Each must have a REAL, SPECIFIC, APPETISING recipe title. No generic names. Vary proteins, cooking methods, and occasions.`
      : normalizedFormat === "spreadsheet"
        ? `CRITICAL: Each tracker-tab section title must be a SPECIFIC, DESCRIPTIVE Excel tab name directly relevant to "${productName}". NO generic names like "Tab 1", "Data", or "Tracker". Title = what users see on the Excel tab. For income/expense trackers: try "Income Tracker", "Expenses Log", "Budget Overview", "Bills & Subscriptions", "Savings Goals".`
        : ""}
Section titles must be benefit-driven and specific to this product. No markdown, no explanation.`;

  const isNonPlanner = normalizedFormat !== "planner";
  if (isNonPlanner) {
    console.log("[DIAG] OUTLINE step 1 — prompt sent to OpenAI", { format: normalizedFormat, promptLength: prompt.length, promptPreview: prompt.slice(0, 200) });
  }

  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a digital product outline expert. Return only valid JSON with a 'sections' array of {id, title}. No other keys. For cookbooks, recipe sections must have real, specific recipe names as titles." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: normalizedFormat === "cookbook" ? 3000 : 4000,
      }),
    {
      onRetry: (attempt, delayMs) =>
        console.warn(`[generate-product-content] Outline 429/5xx, retry ${attempt} in ${delayMs / 1000}s`),
    }
  );
  const raw = completion.choices[0]?.message?.content?.trim() || "";
  if (isNonPlanner) {
    console.log("[DIAG] OUTLINE step 2 — raw response from OpenAI", {
      format: normalizedFormat,
      rawLength: raw.length,
      rawPreview: raw.slice(0, 600),
    });
  }
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: { sections?: Array<{ id?: string; title?: string }> };
  try {
    parsed = JSON.parse(jsonStr) as { sections?: Array<{ id?: string; title?: string }> };
  } catch (parseErr) {
    if (isNonPlanner) {
      console.error("[DIAG] OUTLINE step 3 — JSON.parse FAILED", {
        format: normalizedFormat,
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        jsonStrPreview: jsonStr.slice(0, 800),
      });
    }
    throw parseErr;
  }
  let sections: OutlineSection[] = (parsed.sections || []).map((s, i) => ({
    id: typeof s.id === "string" && s.id ? s.id : `section-${i + 1}`,
    title: typeof s.title === "string" && s.title ? s.title : `Section ${i + 1}`,
  }));
  if (isNonPlanner) {
    console.log("[DIAG] OUTLINE step 3 — parsed into sections", { format: normalizedFormat, sectionCount: sections.length, sectionIds: sections.map((s) => s.id) });
  }
  if (sections.length === 0) throw new Error("AI returned no outline sections");

  // Enforce requested chapter count for ebook/guide/workbook
  const prefixCount = 4; // outcome-promise, fast-start, framework, intro
  const suffixCount = 1; // disclaimer
  const expectedTotal = prefixCount + numChapters + suffixCount;
  const usesChapterCount =
    normalizedFormat === "ebook" ||
    normalizedFormat === "guide" ||
    normalizedFormat === "workbook" ||
    (normalizedFormat !== "planner" &&
      normalizedFormat !== "checklist" &&
      normalizedFormat !== "journal" &&
      normalizedFormat !== "notion" &&
      normalizedFormat !== "course" &&
      normalizedFormat !== "spreadsheet" &&
      normalizedFormat !== "cookbook");
  if (usesChapterCount && sections.length > expectedTotal) {
    sections = [
      ...sections.slice(0, prefixCount),
      ...sections.slice(prefixCount, prefixCount + numChapters),
      sections[sections.length - 1]!,
    ];
  }

  return sections;
}

const WORD_HINT_BY_LENGTH: Record<string, string> = {
  short: "~400–500 words",
  medium: "~700–800 words",
  long: "~1000–1200 words",
};

/** Generate body (and optional imagePrompt) for a single section. Used for incremental generation. */
export async function generateSingleSectionBody(
  params: GenerateProductContentParams,
  section: OutlineSection,
  sectionIndex: number,
  totalSections: number
): Promise<{ body: string; imagePrompt?: string }> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const { productName, format, niche, customizationOptions } = params;
  const ctx = CONTEXT_BLOCK(params);
  const normalizedFormat = normalizeFormat(format);

  // ─── Cookbook/Recipe detection ────────────────────────────────────────────────
  const isCookbook = normalizedFormat === "cookbook";
  const isRecipeSection = isCookbook && /^recipe-?\d+$/.test(section.id);
  const isCookbookSupportSection = isCookbook && !isRecipeSection;

  // ─── Standard section type detection ─────────────────────────────────────────
  const fixedSectionIds = ["outcome-promise", "fast-start", "framework", "disclaimer"];
  const isFixedSection = fixedSectionIds.includes(section.id);
  const isLastSection = sectionIndex === totalSections - 1;
  const isMainContentByPosition = sectionIndex >= 3 && sectionIndex < totalSections - 1;

  const isEbookGuideMainSection =
    !isCookbook &&
    (normalizedFormat === "ebook" || normalizedFormat === "guide") &&
    (section.id === "intro" || /^ch\d+$/.test(section.id) || section.id.startsWith("ch"));

  const isWorkbookMainSection =
    normalizedFormat === "workbook" &&
    (section.id === "intro" || /^ch\d+$/.test(section.id) || section.id.startsWith("prompt") || isMainContentByPosition);

  const isNotionSection =
    normalizedFormat === "notion" &&
    (["dashboard", "calendar-view", "table-view", "revenue-tracker", "weekly-planning"].includes(section.id) ||
      section.id.startsWith("p") ||
      isMainContentByPosition);

  const isPlannerSection =
    normalizedFormat === "planner" &&
    (/monthly|weekly|task|goal|progress|daily/.test(section.id) ||
      ["monthly-overview", "weekly-breakdown", "task-section", "goal-tracker", "progress-tracker"].includes(section.id) ||
      isMainContentByPosition);

  const isChecklistSection =
    normalizedFormat === "checklist" &&
    (/^check\d+$/.test(section.id) || section.id.startsWith("check") || (!isFixedSection && !isLastSection));

  const isCourseModule =
    normalizedFormat === "course" &&
    (/^mod\d+$/.test(section.id) || section.id.startsWith("mod") || isMainContentByPosition);

  const isJournalPrompt =
    normalizedFormat === "journal" &&
    (/^daily\d+$/.test(section.id) || /^p\d+$/.test(section.id) || section.id.startsWith("daily") || section.id.startsWith("p") || (!isFixedSection && !isLastSection));

  const isSpreadsheetFormat = normalizedFormat === "spreadsheet";
  const isSpreadsheetTrackerTab = isSpreadsheetFormat && !isFixedSection && section.id.startsWith("tracker-tab");
  const isSpreadsheetSetup = isSpreadsheetFormat && !isFixedSection && (section.id === "getting-started" || section.id === "overview" || section.id === "setup");
  // Legacy: handle old-style IDs (tab1, tab2, tab3) in case of previously saved products
  const isSpreadsheetLegacyTab = isSpreadsheetFormat && !isFixedSection && /^(tab\d+|formulas?|tips?)$/.test(section.id);
  const isSpreadsheetSection = isSpreadsheetTrackerTab || isSpreadsheetSetup || isSpreadsheetLegacyTab;
  const spreadsheetDifficulty = customizationOptions?.spreadsheet?.difficulty ?? "beginner";
  const spreadsheetIncludePractice = customizationOptions?.spreadsheet?.includePracticeExercises ?? true;

  const contentStyle = customizationOptions?.contentStyle ?? "text_with_placeholders";
  const wantImagePrompt = contentStyle === "text_with_ai_images";
  const imageLine = wantImagePrompt
    ? 'For main chapters (ch1, ch2, etc.) also provide a 1-sentence "imagePrompt" for a DALL-E illustration.'
    : "Do not include imagePrompt.";

  const country = customizationOptions?.cookbook?.country ?? "UK";
  const measurements = customizationOptions?.cookbook?.measurementSystem ?? "metric";
  const dietaryFocus = customizationOptions?.cookbook?.dietaryFocus ?? "";

  // ─── Recipe card instruction ────────────────────────────────────────────────
  const recipeInstruction = isRecipeSection ? `
Generate a COMPLETE, READY-TO-COOK recipe for: "${section.title}"

Cookbook: "${productName}" | Niche: ${niche}${dietaryFocus ? ` | Dietary focus: ${dietaryFocus}` : ""}
Country: ${country} — use ${measurements === "metric" ? "grams, ml, Celsius" : "cups, oz, Fahrenheit"} and ${country === "UK" ? "UK ingredient names (e.g. coriander not cilantro, spring onion not scallion, courgette not zucchini)" : "standard ingredient names"}.

Return this EXACT HTML structure (ALL fields are mandatory — do not omit any):

<div class="recipe-card">
  <p class="recipe-description">[2–3 sentences: what this dish is, who it's perfect for, what makes it special. Be specific and appetising — not generic.]</p>

  <div class="recipe-meta">
    <span>🍽️ Serves: [number]</span>
    <span>⏱️ Prep: [X mins]</span>
    <span>🔥 Cook: [X mins]</span>
    <span>⏰ Total: [X mins]</span>
    <span>💰 ~${country === "UK" ? "£" : country === "US" ? "$" : country === "Australia" ? "A$" : "£"}[X.XX] per serving</span>
    <span>⭐ [Easy / Medium / Challenging]</span>
  </div>

  <h3>Ingredients</h3>
  <ul>
    [8–14 ingredients. Format EXACTLY as: "400g chicken breast, sliced thin" — exact quantity + unit + preparation note. NEVER use "some", "a handful", "to taste" without a backup quantity.]
  </ul>

  <h3>Method</h3>
  <ol>
    [5–8 steps. Each step must be specific: what to do, how to do it, what it looks/smells like when done. E.g. "Heat 1 tbsp olive oil in a large frying pan over medium-high heat until shimmering, about 1 minute." NOT "Cook until ready."]
  </ol>

  <div class="recipe-notes">
    <h4>🧊 Storage</h4>
    <p>[Specific times: "Refrigerate in an airtight container for up to 3 days. Freeze for up to 2 months. Reheat in microwave for 2–3 minutes or in a pan with 2 tbsp water until piping hot."]</p>

    <h4>🌿 Dietary</h4>
    <p>[Which labels apply: gluten-free, dairy-free, nut-free, vegetarian, vegan, etc. Note main allergens (e.g. "Contains: gluten, dairy").]</p>

    <h4>🔄 Substitutions</h4>
    <p>[2–3 specific swaps: "Replace chicken with firm tofu for a vegetarian version (cook 3–4 minutes per side until golden)." "Use coconut aminos instead of soy sauce to make soy-free."]</p>

    <h4>💡 Tip</h4>
    <p>[One practical tip that makes this dish noticeably better or easier.]</p>
  </div>
</div>

RULES:
- EVERY ingredient needs an exact quantity (never "some chicken" or "a few vegetables")
- EVERY method step must be specific — no "cook until done", "season to taste alone", "heat through"
- Cost per serving must be realistic for ${country === "UK" ? "UK Aldi/Tesco" : "standard supermarket"} prices (2024)
- Nutritional values: ONLY include if you are confident they are accurate; otherwise omit
- NO invented testimonials, fake families, or made-up results
` : "";

  // ─── Cookbook support section instructions ───────────────────────────────────
  const cookbookSupportInstruction = isCookbookSupportSection ? (() => {
    const currencySymbol = country === "UK" ? "£" : country === "US" ? "$" : "A$";

    if (section.id === "how-to-use") return `
Generate a concise, practical "How to Use This Cookbook" introduction for "${productName}".

Cover (200–300 words, no more):
- How the recipes are organised (e.g. by meal type, cooking time)
- How to use the meal plan and shopping list
- A brief note on measurements (${measurements === "metric" ? "grams, ml, Celsius" : "cups, oz, Fahrenheit"})
- How to use the substitution guide for dietary needs
- An honest sentence about estimated prep times

Write warmly but practically. Do NOT use generic motivational speech like "embark on your journey" or "this book will transform your life." Just tell the reader how to get the most out of it.

Use <p> and <h3> for sub-sections. No filler.`;

    if (section.id === "pantry-essentials") return `
Generate a practical pantry essentials list for a ${niche} cookbook. This is a categorised list of staple ingredients to keep stocked.

Format as HTML lists with clear categories:
<h3>Oils, Vinegars & Condiments</h3><ul>...</ul>
<h3>Tins & Jars</h3><ul>...</ul>
<h3>Dry Goods, Pasta & Grains</h3><ul>...</ul>
<h3>Spices & Seasonings</h3><ul>...</ul>
<h3>Fridge Staples</h3><ul>...</ul>
<h3>Freezer Staples</h3><ul>...</ul>

Include 6–10 items per category. For any less obvious items, add a brief note in brackets explaining why it's useful (e.g. "Miso paste [adds depth to sauces and marinades]").

Use ${country} ingredient names. No filler text — just the list.`;

    if (section.id === "meal-plan") return `
Generate a practical 7-day meal plan using recipes from "${productName}".

Use <table> format with columns: Day | Breakfast | Lunch | Dinner | Estimated Prep Time
For each meal, reference one of the recipes in the cookbook (use approximate titles).

Below the table, add 3 practical sub-sections:
<h3>Batch Cooking Suggestion</h3>
<p>Which recipe to double on Sunday and how to use the leftovers across the week.</p>

<h3>Quickest Day</h3>
<p>Which day has the fastest total prep, and why (for exhausted evenings).</p>

<h3>Prep Ahead Tips</h3>
<p>3–4 specific things you can do on Sunday to reduce weekday cooking time (e.g. "chop and store all veg for Mon–Wed in labelled containers").</p>

Keep it specific and actionable. No generic "eat more vegetables" advice.`;

    if (section.id === "shopping-list") return `
Generate a complete, categorised shopping list for the 7-day meal plan in "${productName}".

Organise by supermarket aisle using <h3> headings and <ul> lists:
<h3>Fresh Produce</h3>
<h3>Meat, Fish & Poultry</h3>
<h3>Dairy & Eggs</h3>
<h3>Tins, Jars & Sauces</h3>
<h3>Dry Goods, Pasta & Rice</h3>
<h3>Frozen</h3>
<h3>Bakery & Bread</h3>
<h3>Store Cupboard & Condiments</h3>

Include specific quantities (e.g. "Chicken breast — 1.5kg" not just "chicken"). Combine quantities for ingredients used in multiple recipes.

End with:
<p><strong>Estimated weekly shop:</strong> approximately ${currencySymbol}[realistic estimate] for [N] servings</p>
<p><em>Prices based on ${country === "UK" ? "Aldi/Tesco" : "standard supermarket"} averages, 2024. Adjust for your local store.</em></p>`;

    if (section.id === "substitutions") return `
Generate a practical dietary substitution guide for "${productName}".

Format as clear sections with a brief intro and specific swaps:

<h3>Gluten-Free Swaps</h3>
[Common ingredients in this cookbook that contain gluten + exact gluten-free alternatives, with notes on whether the texture/taste changes]

<h3>Dairy-Free Swaps</h3>
[Dairy ingredients + dairy-free alternatives with usage ratios where relevant]

<h3>Egg-Free Swaps</h3>
[If eggs are used + alternatives]

<h3>Vegetarian & Vegan Swaps</h3>
[Meat/fish ingredients + plant-based alternatives, with cooking adjustments needed]

<h3>Budget Swaps</h3>
[Premium ingredients + cheaper alternatives that still work well]

<h3>Nut-Free Alternatives</h3>
[Any nut-containing ingredients + nut-free swaps]

For each substitution: ingredient being replaced → exact replacement + quantity ratio if different + any technique note. Keep it practical and specific to the recipes in this cookbook.`;

    if (section.id === "leftover-guide") return `
Generate a practical leftover repurposing guide for "${productName}".

Format as a series of specific scenarios:

<h3>🍗 Leftover [Protein]? Turn it into...</h3>
(For each common leftover from the cookbook's recipes — 6–8 scenarios)
<ul>
  <li><strong>[Leftover ingredient]</strong> → [2–3 specific ways to repurpose: e.g. "shred into tacos", "slice for sandwiches", "stir into fried rice with frozen veg"]</li>
</ul>

End with:
<h3>Freezing Leftovers: What Works & What Doesn't</h3>
[Practical table or list: which dishes freeze well, which don't, and max freezer time. E.g. "Soups and stews ✅ up to 3 months | Pasta dishes ⚠️ texture changes | Fresh salads ❌"]

Keep it specific to the types of recipes in this cookbook. No filler — just the practical guide.`;

    if (section.id === "printable-planner") return `
Generate a printable weekly meal planner template in HTML for "${productName}".

This is a user-fillable template. Format using <table> with borders and generous cell sizes.

Structure:
- Header: "Weekly Meal Planner" | "Week of: _______________"
- Main table: 7 rows (Monday–Sunday), 4 columns: Day | Breakfast | Lunch | Dinner
- Each cell should be tall enough to write in — use min-height: 60px style or [WRITE HERE] placeholder
- Below the main table: a "Shopping list" section with 2 columns of blank lines
- Below that: a "Prep notes" box with blank lines

Style with:
<table style="border-collapse: collapse; width: 100%;">
  <th style="background: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left;">

Add footer: "From ${productName}"

Keep it clean, functional, and printable. No dense prose — this is a blank form.`;

    if (section.id === "final-page") return `
Generate a warm, brief closing page for "${productName}" (150–200 words maximum).

Include:
- A genuine thank-you for using the cookbook (2–3 sentences, not generic)
- An invitation to share results: "Share your meals and tag us on social media"
- Placeholder for author details:
  <p><strong>[AUTHOR NAME]</strong></p>
  <p>Website: [YOUR WEBSITE]</p>
  <p>Instagram: @[YOUR HANDLE]</p>
- A copyright notice: <p><em>© [YEAR] [AUTHOR NAME]. All rights reserved. No part of this cookbook may be reproduced without permission.</em></p>

Write it as if the author is speaking directly to the reader. Do NOT use generic AI speech like "embark on your culinary journey" or "transform your mealtimes". Just a real, warm closing from a real person.`;

    // Generic cookbook support section fallback
    return `Generate practical, specific content for "${section.title}" in the cookbook "${productName}". Format with HTML <h3> subheadings, <ul>/<ol> lists, and <table> where appropriate. Keep it actionable — no filler motivational text.`;
  })() : "";

  // ─── Standard format instructions ─────────────────────────────────────────────
  const lengthKey = customizationOptions?.contentLength ?? "medium";
  const wordHint = WORD_HINT_BY_LENGTH[lengthKey] ??
    (normalizedFormat === "workbook" ? "400–500 words"
      : normalizedFormat === "ebook" ? "700–900 words"
        : normalizedFormat === "guide" ? "600–800 words"
          : "500–700 words");

  // EBOOK/GUIDE: teaching tone, unique content per chapter, no fake case studies
  const ebookGuideInstruction = isEbookGuideMainSection ? `
This is an EBOOK/GUIDE section (section ${sectionIndex + 1} of ${totalSections}).

Teaching tone. This section covers: "${section.title}" — a topic DISTINCT from all other chapters.

Structure:
1. Opening: Start with a specific, vivid scenario or concrete question (NOT "In today's world..." or "Have you ever wondered...")
2. Core concept: 2–3 paragraphs explaining the key idea with clarity. Use plain language.
3. Worked example: One concrete, specific example (use a hypothetical scenario or practical "For instance..." — do NOT invent named people or fake research results)
4. Practical application: <div class="callout"><strong>Try this:</strong> [specific action steps]</div>
5. Common pitfalls: <h3>What to avoid</h3> with 2–3 specific mistakes
6. Summary: 3 key takeaways as a <ul>

${ANTI_CLICHE_BLOCK}

${wordHint} of HTML. Use <h2>, <h3>, <p>, <ul>, <ol>, <div class="callout">. No workbook fill-ins. No invented testimonials or fake statistics.` : "";

  // WORKBOOK: brief explanation, prompts, writing spaces
  const workbookInstruction = isWorkbookMainSection ? `
This is a WORKBOOK section. Minimal theory. Structure: very brief explanation (2–3 sentences), then prompt or question, then blank writing space. Use <div class="writing-space"> with lines or ___ for fill-in. Use [FILL IN] or ___ for user input. Optional <ul class="checklist"><li>☐</li></ul>. No long paragraphs — focus on prompts, lines, boxes. 300–400 words max.` : "";

  // NOTION: Setup guide with databases, views, properties
  const notionInstruction = isNotionSection ? `
This is a NOTION TEMPLATE section. Output a structured setup guide for this component. Include: database properties with types (text, select, date, etc.), views (Calendar/Table/Board as relevant), filters, tags, template blocks. Use <h2>, <h3>, <ul>, <ol>. Describe step-by-step how to set it up in Notion. 300–500 words. No workbook content.` : "";

  // PLANNER: Execution-focused. Calendars, time blocks, goal trackers
  const plannerInstruction = isPlannerSection ? `
This is a PLANNER section. Execution-focused only. Output LAYOUT: calendars, time blocks, goal trackers, progress trackers. Use <table> for grids, <th> for day names or time slots, [FILL IN] or ___ for user input. NO long paragraphs — only planning structure. 150–350 words of HTML.` : "";

  // CHECKLIST: Tick boxes only, no long prose
  const checklistInstruction = isChecklistSection ? `
This is a CHECKLIST PACK section. Output ONLY checkbox lists. Format: <ul class="checklist"><li>☐ Action item (one short line).</li></ul>. Use ☐ (empty box). 15–25 items per section. Each item must be a concrete, specific action — not a vague concept. No long paragraphs, no explanations.` : "";

  // COURSE: Module with lessons, objectives
  const courseInstruction = isCourseModule ? `
This is a COURSE OUTLINE module. Output: module overview (1–2 paragraphs), <h3>Learning objectives</h3><ul>...</ul>, <h3>Lessons</h3><ol><li>Lesson title: short description.</li></ol>, <h3>Resources</h3>, key takeaways. Use benefit-driven lesson titles. 500–700 words of HTML.` : "";

  // SPREADSHEET: Tracker tab = proper table; Setup section = brief text
  const spreadsheetInstruction = isSpreadsheetTrackerTab || isSpreadsheetLegacyTab ? `
This is an EXCEL/GOOGLE SHEETS TRACKER TAB for the spreadsheet product "${productName}".
Tab name: "${section.title}"

MANDATORY: Output MUST start with a complete <table> immediately. This table IS the product.

<table>
  <tr>
    <th>[Column 1 — choose the most relevant column headers for "${section.title}" in a ${niche} context]</th>
    <th>[Column 2]</th>
    <th>[Column 3]</th>
    ... (4–7 columns total)
  </tr>
  <tr>
    <td>[Sample row 1 — realistic data values, NOT placeholders like "XXX" or "[amount]"]</td>
    ...
  </tr>
  <tr>
    <td>[Sample row 2]</td>
    ...
  </tr>
  <tr>
    <td>[Sample row 3]</td>
    ...
  </tr>
</table>

Column rules:
- Include a Date or Month column where relevant
- For financial data: use UK pounds (£), realistic values (e.g. 1200.00 not just "100")
- Column names must be specific (not just "Amount" — use "Amount (£)", "Monthly Cost (£)", etc.)
- Sample rows must contain REAL values a user would actually enter (dates like "01/01/2024", categories like "Groceries", amounts like "345.80")
- If the CREATOR EXPERTISE / TARGET READER block above mentions a specific persona (e.g. income amounts, job type, family situation), use consistent sample data that reflects that exact persona throughout your sample rows
- Keep sample data consistent across rows — if row 1 is for "January", don't mix with "March" in row 2

After the table, add:
<h3>Key Formulas for This Tab</h3>
<ul>
  <li><strong>Total:</strong> <code>=SUM(D2:D100)</code> — [explain what this sums for this specific tab]</li>
  <li><strong>[Useful formula]:</strong> <code>=[formula relevant to this tab's data]</code> — [what it calculates]</li>
</ul>
<p><small>💡 Tip: [One practical tip for using this tab effectively]</small></p>

Keep all prose minimal. The table is the deliverable.
` : isSpreadsheetSetup ? `
Generate brief "Getting Started" instructions for the spreadsheet product "${productName}".

Output 150–180 words of HTML covering:
- What this spreadsheet tracks and why it's useful for ${niche}
- A bullet list of the tabs included (use the actual product-relevant tab names)
- Which tab to start with and how to enter data
- One note about formulas (they calculate automatically — just enter data)

Use <p> and <ul>. No marketing language. No padding.
` : "";

  // JOURNAL: Date field, unique prompts, writing space
  const journalInstruction = isJournalPrompt ? `
This is a JOURNAL page. Include: (1) Date field: "Date: _______________", (2) 2–3 reflection prompts as <h3> or <p> (UNIQUE to this day — not repeated from other pages), (3) <div class="writing-space"> for writing space, (4) Affirmation. Mindset/reflective tone. Minimal HTML. No long paragraphs.` : "";

  // DISCLAIMER: Always output a proper disclaimer with correct language per product type
  const isFinancialProduct = /financ|budget|expense|income|money|debt|saving|invest|tax|pension|credit|afford/i.test(productName + " " + niche);
  const disclaimerInstruction = section.id === "disclaimer" ? `
Write a brief disclaimer section for "${productName}" (2–3 short paragraphs, max 150 words total).

${isFinancialProduct ? `FINANCIAL PRODUCT DISCLAIMER — include all of the following:
- "This spreadsheet/guide is for educational and organisational purposes only. It is not financial advice."
- "Always consult a qualified financial adviser before making financial decisions."
- "Figures used as examples are illustrative only and do not represent actual financial advice."
- A short empowerment statement: "Use this as a starting point to build your own financial clarity."` : `Include:
- A one-sentence statement that this product is for educational/informational purposes only
- A note that readers are responsible for applying the information to their own situation
- A short empowerment statement encouraging action`}

${productName.match(/\[|YOUR|WEBSITE|HANDLE/i) ? "" : `End with a basic copyright line:
<p><em>© [YEAR] [AUTHOR NAME]. All rights reserved.</em></p>
<p><em>Website: [YOUR WEBSITE] | Follow us: @[YOUR SOCIAL HANDLE]</em></p>`}

Use <p> tags only. No bold headings. Keep it brief and professional.
` : "";

  // SPREADSHEET FIXED SECTIONS: outcome-promise / fast-start / framework get brief practical content (not ebook essays)
  const spreadsheetFixedInstruction = isSpreadsheetFormat && isFixedSection && section.id !== "disclaimer" ? `
Write a short, practical "${section.title}" section for the spreadsheet product "${productName}" (80–120 words, HTML only).

${section.id === "outcome-promise" ? `This should state what the user will be able to TRACK and UNDERSTAND after using this spreadsheet. Be specific: mention the key things this tracker helps with (e.g. "Track all income sources in one place", "See where money goes each month", "Spot budget gaps before payday"). 3–4 short bullet points using <ul><li>. One opening sentence only — no padding.`
  : section.id === "fast-start" ? `Title exactly: "Quick Start: 3 Steps to Get Going". Output 3 numbered steps for using this spreadsheet immediately: (1) which tab to start with, (2) what to enter first, (3) what to check after filling in one week/month. Use <ol><li>. Each step: one sentence. No padding.`
  : `A simple framework for this product. One short paragraph + 3 bullet points. Keep it practical, not motivational.`}

No ebook-style essays. No "transform your life" language. Just practical guidance.
` : "";

  // Select the format-specific instruction
  const formatSpecificRequirement =
    recipeInstruction ||
    cookbookSupportInstruction ||
    ebookGuideInstruction ||
    workbookInstruction ||
    notionInstruction ||
    plannerInstruction ||
    checklistInstruction ||
    courseInstruction ||
    journalInstruction ||
    spreadsheetInstruction ||
    spreadsheetFixedInstruction ||
    disclaimerInstruction;

  const baseRequirements = formatSpecificRequirement
    ? formatSpecificRequirement
    : `${wordHint} of HTML. Use <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li>. Include opening, main content, specific examples, action items, summary where appropriate. ${ANTI_CLICHE_BLOCK}`;

  const formatRuleLine =
    normalizedFormat === "cookbook"
      ? (isRecipeSection ? "Format is COOKBOOK RECIPE: full recipe card with exact quantities, method, storage, dietary info, substitutions." : "Format is COOKBOOK SUPPORT: practical reference section with lists, tables, and specific information.")
      : normalizedFormat === "workbook"
        ? "Format is WORKBOOK: brief explanation, prompts, writing spaces, fill-in fields. Minimal theory."
        : normalizedFormat === "ebook" || normalizedFormat === "guide"
          ? "Format is EBOOK/GUIDE: teaching tone, specific examples, no fill-ins, no invented case studies."
          : normalizedFormat === "planner"
            ? "Format is PLANNER: layouts only (calendars, time blocks, trackers). No long paragraphs."
            : normalizedFormat === "journal"
              ? "Format is JOURNAL: date, unique reflection prompts, writing space, affirmation."
              : normalizedFormat === "checklist"
                ? "Format is CHECKLIST: tick boxes (☐) and short concrete action items only. No long paragraphs."
                : normalizedFormat === "notion"
                  ? "Format is NOTION: setup guide for databases/views. Practical and specific."
                  : normalizedFormat === "course"
                    ? "Format is COURSE: module with lessons, objectives, resources."
                    : normalizedFormat === "spreadsheet"
                      ? (isSpreadsheetTrackerTab || isSpreadsheetLegacyTab
                          ? "Format is SPREADSHEET TRACKER TAB: start immediately with a complete <table> with real column headers and realistic sample data rows. Add formula examples in <code>. Minimal prose."
                          : "Format is SPREADSHEET SETUP: brief practical text instructions. No table required.")
                      : "";

  const prompt = `Product: "${productName}". Niche: ${niche}.
${ctx}

SELECTED FORMAT: "${normalizedFormat}". ${formatRuleLine}

Write ONLY the content for this section (section ${sectionIndex + 1} of ${totalSections}):
- id: "${section.id}"
- title: "${section.title}"

Requirements: ${baseRequirements}
${!isRecipeSection && !isCookbookSupportSection ? imageLine : ""}

Return ONLY valid JSON: {"body": "<html content here>"}. No code fences. No markdown.`;

  const isNonPlannerSection = normalizedFormat !== "planner";
  if (isNonPlannerSection) {
    console.log("[DIAG] SECTION step 1 — prompt sent to OpenAI", { format: normalizedFormat, sectionId: section.id, promptLength: prompt.length });
  }

  // System message selection
  const systemMessage =
    isRecipeSection
      ? RECIPE_CARD_SYSTEM
      : isCookbookSupportSection
        ? "You write practical cookbook reference content. Be specific, practical, and use HTML tables and lists. No motivational filler. Return only valid JSON with a body field. No markdown."
        : normalizedFormat === "checklist"
          ? "You write checklist pack content. Output ONLY checkbox lists (☐) and short concrete action items. No long paragraphs. Return only valid JSON with body and optional imagePrompt. No markdown."
          : normalizedFormat === "planner"
            ? "You write planner layout content. Output ONLY planning structure: calendars, time blocks, trackers, tables. No long paragraphs. Return only valid JSON with body and optional imagePrompt. No markdown."
            : normalizedFormat === "journal"
              ? "You write journal page content. Output date field, unique reflection prompts, writing space, affirmation. Return only valid JSON with body and optional imagePrompt. No markdown."
              : normalizedFormat === "notion"
                ? "You write Notion setup guide content. Describe databases, views, filters, templates. No workbook-style content. Return only valid JSON with body and optional imagePrompt. No markdown."
                : normalizedFormat === "spreadsheet"
                  ? "You write Excel/Google Sheets tracker content. For tracker tab sections, output a complete <table> with real column headers and realistic sample data rows — no placeholders. For setup sections, output brief instructional text. Include formula examples in <code> tags. Return only valid JSON with body field. No markdown."
                  : SYSTEM_PREMIUM;

  const tokenLimit = isRecipeSection ? COOKBOOK_RECIPE_TOKENS : MAX_SECTION_TOKENS;

  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        temperature: isRecipeSection ? 0.6 : 0.7,
        max_tokens: tokenLimit,
      }),
    {
      onRetry: (attempt, delayMs) =>
        console.warn(`[generate-product-content] Section body 429/5xx, retry ${attempt} in ${delayMs / 1000}s`),
    }
  );

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  if (isNonPlannerSection) {
    console.log("[DIAG] SECTION step 2 — raw response from OpenAI", {
      format: normalizedFormat,
      sectionId: section.id,
      rawLength: raw.length,
      rawPreview: raw.slice(0, 400),
    });
  }
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: { body?: string; imagePrompt?: string };
  try {
    parsed = JSON.parse(jsonStr) as { body?: string; imagePrompt?: string };
  } catch (parseErr) {
    if (isNonPlannerSection) {
      console.error("[DIAG] SECTION step 3 — JSON.parse FAILED", {
        format: normalizedFormat,
        sectionId: section.id,
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        jsonStrPreview: jsonStr.slice(0, 500),
      });
    }
    throw parseErr;
  }
  const body = typeof parsed.body === "string" && parsed.body ? parsed.body : "";
  const imagePrompt =
    typeof parsed.imagePrompt === "string" && parsed.imagePrompt.trim() ? parsed.imagePrompt.trim() : undefined;
  if (isNonPlannerSection) {
    console.log("[DIAG] SECTION step 3 — parsed, saving (caller will persist to DB)", {
      format: normalizedFormat,
      sectionId: section.id,
      bodyLength: body.length,
    });
  }
  return { body, imagePrompt };
}
