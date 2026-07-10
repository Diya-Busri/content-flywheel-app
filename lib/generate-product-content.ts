import OpenAI from "openai";
import { cleanProductTitle } from "./product-title";
import { withRetry429 } from "./openai-with-retry";

export type GenerateContentSection = { id: string; title: string; body: string; imagePrompt?: string };

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/** Customization from Discovery step 7 (optional). Kept within limits for generation speed (<60s target). */
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
};

/** Sensible limits so generation stays under ~60s. Default 4 chapters, medium ~800 words. */
const DEFAULT_CHAPTERS = 4;
const MAX_CHAPTERS = 6;
/** Planner: max 7 sections by default (outcome-promise, fast-start, framework, 4 planner layouts, disclaimer) for speed. */
const MAX_PLANNER_SECTIONS = 7;
const MAX_SECTION_TOKENS = 2500;

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

const SYSTEM_PREMIUM =
  "You are an expert digital product creator. Your content must be comprehensive, in-depth, and valuable—the kind of content customers would gladly pay for. This is premium content users will pay $37–97 for; make it extremely valuable and comprehensive. Write content that fills full pages. Include extensive details, real-world examples, and actionable advice. Never write short or superficial sections; every section must meet the minimum word count. Return only valid JSON with a 'sections' array. Output HTML only in body fields—no markdown, no code fences, no explanation.";

const CONTEXT_BLOCK = (params: GenerateProductContentParams) =>
  `PRODUCT CONTEXT:
- Name: "${params.productName}"
- What's included: ${params.productIncluded || "N/A"}
- Why it sells / audience: ${params.productWhy || "N/A"}
${params.productDescription ? `- Description: ${params.productDescription}` : ""}
${params.creatorExpertise ? `CREATOR EXPERTISE & UNIQUE ANGLE: The creator has provided the following personal context — you MUST weave this into the content so it reflects their voice, experience, and perspective rather than generic AI output: "${params.creatorExpertise}"` : ""}
NICHE: ${params.niche || "General audience"}
${params.subFocus ? `SUB-FOCUS (this product must cover ONLY this angle of the niche; do not repeat the same content as other products): ${params.subFocus}` : ""}
${params.hookTexts?.length ? `HOOKS (weave into content): ${params.hookTexts.join(" | ")}` : ""}
${params.ctaTexts?.length ? `CTAs: ${params.ctaTexts.join(" | ")}` : ""}
${params.customizationOptions?.tone ? `TONE: Write in a ${params.customizationOptions.tone} tone throughout.` : ""}`;

const CONTENT_STRUCTURE_REQUIREMENTS = `
EACH SECTION MUST INCLUDE (where applicable):
- Opening hook: 2–3 sentences that grab attention and set up the section
- Main explanation: 3–5 full paragraphs of detailed content
- Real-world examples: 2–3 concrete examples (case studies, scenarios, or stories)
- Step-by-step breakdown where relevant
- Common mistakes to avoid (warnings, pitfalls)
- Pro tips / best practices
- Action items or exercises the reader can do
- Summary or key takeaways at the end`;

const SELLABLE_STRUCTURE = `
SELLABLE CONTENT (include these sections in this order):
1. outcome-promise (id): 2–3 paragraphs. A compelling intro that clearly states what the reader will ACHIEVE. Be transformational, not just informational. Example tone: "By the end of this [product], you will have clarity on [X], [Y], [Z], and a repeatable system for [outcome]." Focus on outcomes and transformation.
2. fast-start (id): Title exactly "Quick Wins: 3 Things You Can Do Today". Body: 3 immediate, actionable steps the reader can do in under 30 minutes. Use <ol> or clear numbered items. Boosts completion and buyer confidence.
3. framework (id): A simple branded model buyers can teach and rebrand (e.g. "The IGLP Method: Income, Growth, Protection, Legacy"). Title = the framework name. Body: one short paragraph + 4–5 pillars with one line each. Make it memorable and applicable to the niche.
4. [then your intro and main chapters/sections...]
5. disclaimer (id): One short paragraph. Empowering statement that builds trust without dampening momentum (e.g. "This guide is for educational purposes. You are responsible for your own decisions. Use it as a springboard to take action."). Place at the end of the sections array.`;

const CHAPTER_TITLES_RULE = `
CHAPTER/SECTION TITLES: Use benefit-driven, outcome-focused titles—not just topic labels. Examples: "Building a Savings Strategy" → "Building a Wealth Engine for Retirement"; "Creating a Retirement Income Plan" → "Designing Predictable, Inflation-Resistant Income". Every chapter/section title should promise a transformation or clear benefit.`;

const htmlRules = `OUTPUT RULES: Return body as clean HTML only. Use <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li>. No markdown (** or ##).`;

function buildPrompt(params: GenerateProductContentParams): { prompt: string; useGpt4: boolean; maxTokens: number } {
  const { productName, format = "ebook", niche } = params;
  const subTopic = params.subFocus?.trim() || niche || "the topic";
  let normalizedFormat = (format || "ebook").toLowerCase().trim();
  if (normalizedFormat === "course outline") normalizedFormat = "course";
  if (normalizedFormat === "checklist pack") normalizedFormat = "checklist";
  if (normalizedFormat === "notion template") normalizedFormat = "notion";
  const ctx = CONTEXT_BLOCK(params);

  if (normalizedFormat === "ebook") {
    return {
      useGpt4: true,
      maxTokens: params.bundleMode ? 10000 : 16000,
      prompt: `Create an EBOOK titled "${productName}" for the ${niche} niche.

Write a fully prose-based ebook on ${subTopic}. ${params.bundleMode ? "4-5 chapters" : "6-8 chapters"}. Each chapter has: title, intro paragraph, 3-4 subheadings with written content, a real-world example, and a chapter summary. No fill-in sections. No checklists. Pure educational reading content.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

Use <h2>, <h3> for chapters and subheadings. Use <p> for paragraphs. You may use <div class="callout"> for key tips. No workbook fill-ins, no □ checklists, no <table>. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. ${htmlRules} No markdown.`,
    };
  }

  if (normalizedFormat === "workbook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a WORKBOOK titled "${productName}" for the ${niche} niche.

Write a chapter-based workbook on ${subTopic}. 5-6 chapters. Each chapter must follow this exact structure: (1) Chapter title + 2-paragraph teaching intro explaining the concept, (2) Core lesson — 3-4 paragraphs going deeper with examples, (3) 3 exercises directly based on that chapter's content with instructions and fill-in response lines, (4) 3 reflection questions linking the chapter to the reader's personal situation, (5) Chapter summary and key takeaway. Exercises must relate directly to the chapter content, never generic.

${ctx}

Use <div class="writing-space"> with ___ or blank lines for written responses. Use <ul class="checklist"><li>☐</li></ul> for checklists. Sections: outcome-promise, fast-start, framework, intro, then ch1, ch2, ch3, ch4, ch5 (and ch6 if 6 chapters), disclaimer. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. Body = HTML with writing-space divs, ___ fill-ins. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "guide") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a GUIDE titled "${productName}" for the ${niche} niche.

Write a practical how-to guide on ${subTopic}. Structure: introduction explaining the problem this guide solves, 5-7 numbered steps or sections each with a title, explanation, and concrete example, a quick reference summary section at the end. Conversational tone. Action-focused. No fill-in sections.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

Sections: outcome-promise, fast-start, framework, intro, step1, step2, step3, step4, step5, step6 (and step7 if 7 steps), summary, disclaimer. Each step: <h2>Step N: Title</h2>, explanation, concrete example. ${htmlRules} Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}.`,
    };
  }

  if (normalizedFormat === "spreadsheet") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Generate a SPREADSHEET TUTORIAL titled "${productName}" for the ${niche} niche.

Generate a practical spreadsheet tutorial on ${subTopic}. Include: what the spreadsheet tracks and why, step-by-step setup instructions with actual column names, real formula examples like =AVERAGE(), =COUNTIF(), =IF() relevant to the topic, conditional formatting rules, 3 example use cases with realistic sample data, and a tips/troubleshooting section.

${ctx}

Write in tutorial format. Use HTML: <h2>, <h3>, <p>, <ul>, <ol>, <strong>. Include "imagePrompt" for each section: a 1-sentence DALL-E prompt for a spreadsheet screenshot-style illustration. Return 4-8 sections as valid JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. ${htmlRules} No markdown.`,
    };
  }

  if (normalizedFormat === "notion") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a NOTION TEMPLATE for "${productName}" (${niche} niche).

Generate a Notion template for ${subTopic} in markdown format. Include: template name and purpose, all pages and databases with their exact property names and types (text, select, multi-select, date, checkbox, number, relation), how pages link together, 3-5 realistic sample entries showing real data, and step-by-step usage instructions.

${ctx}

Sections: outcome-promise, fast-start, framework, template-overview, pages-databases, sample-entries, usage-instructions, disclaimer. Body may use markdown or HTML describing structure, properties, and usage. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "checklist" || normalizedFormat === "checklist pack") {
    return {
      useGpt4: true,
      maxTokens: 8000,
      prompt: `Create a CHECKLIST PACK for "${productName}" (${niche} niche).

Generate 6 standalone checklists on ${subTopic}. Each checklist has: a unique title targeting a specific situation, one sentence of context, 15-20 checkbox items that are concrete actions not vague concepts. No long explanations. Each item must be immediately actionable.

${ctx}

Use <ul class="checklist"><li>☐ Action item.</li></ul>. Sections: outcome-promise, fast-start, framework, check1, check2, check3, check4, check5, check6, disclaimer. Each check section: unique title, one sentence context, then 15-20 ☐ items. No prose. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "journal") {
    return {
      useGpt4: true,
      maxTokens: params.bundleMode ? 8000 : 14000,
      prompt: params.bundleMode
        ? `Create a JOURNAL titled "${productName}" for the ${niche} niche.

Generate a guided journal on ${subTopic}. Include: a brief welcome section, 7 daily journal entries (Day 1–7) each with a unique prompt specific to ${subTopic}, and a weekly reflection page. Include fill-in lines throughout.

${ctx}
${SELLABLE_STRUCTURE}

Sections: outcome-promise, fast-start, framework, welcome, daily1, daily2, daily3, daily4, daily5, daily6, daily7, weekly-reflection, disclaimer. Use <div class="writing-space"> and ___ for fill-in lines. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`
        : `Create a JOURNAL titled "${productName}" for the ${niche} niche.

Generate a guided journal on ${subTopic}. Include: a brief welcome/how to use section, 30 daily journal entries each with a unique prompt, a weekly reflection page every 7 days with 4-5 deeper questions, and a monthly review page with prompts for tracking growth. Prompts must be specific to ${subTopic}, not generic. Include fill-in lines throughout.

${ctx}
${SELLABLE_STRUCTURE}

Sections: outcome-promise, fast-start, framework, welcome, then daily1-daily30 (or grouped), weekly-reflection pages, monthly-review, disclaimer. Use <div class="writing-space"> and ___ for fill-in lines. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "planner" || normalizedFormat === "notebook") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a PLANNER titled "${productName}" for the ${niche} niche.

Generate a planner focused on ${subTopic}. Include: monthly overview table (weeks, focus area, top 3 goals, mood/progress tracker, notes), weekly spread (7 days with morning/midday/evening blocks), daily task page (top 3 priorities, to-do list, time blocks, progress tracker), habit tracker grid (30 days), and monthly reflection page. Mostly tables and grids. Minimal prose.

${ctx}
${SELLABLE_STRUCTURE}

Sections: outcome-promise, fast-start, framework, monthly-overview, weekly-spread, daily-task-page, habit-tracker, monthly-reflection, disclaimer. Use <table> for grids, <th> for headers, ___ or [FILL IN] for user input. No explanatory paragraphs. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "course" || normalizedFormat === "course outline") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a COURSE OUTLINE titled "${productName}" for the ${niche} niche.

Generate a structured course outline on ${subTopic}. Include: course title, learning objectives, 4-5 modules each with a module title, description, 4-5 lesson titles with one-line descriptions, and key takeaways. Format like a curriculum document.

${ctx}
${SELLABLE_STRUCTURE}

Each module = <h2>Module N: Title</h2>, short description, <h3>Learning objectives</h3><ul>...</ul>, <h3>Lessons</h3><ol><li>Lesson title: one-line description.</li></ol>, <h3>Key takeaways</h3>. Sections: outcome-promise, fast-start, framework, mod1, mod2, mod3, mod4, mod5, disclaimer. Add "imagePrompt" per module. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. ${htmlRules}`,
    };
  }

  // Default: ebook-style with full length (unknown format)
  return {
    useGpt4: true,
    maxTokens: 16000,
    prompt: `Generate full CONTENT for "${productName}" (${niche} niche). Format: ${format}. Focus on: ${subTopic}.

This is premium content users will pay $37–97 for. Make it extremely valuable and comprehensive. Write comprehensive, in-depth content that fills 2–3 full pages per section.
${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}
${CONTENT_STRUCTURE_REQUIREMENTS}

MINIMUM: 500–800 words per section. Include opening hook, main explanation (3–5 paragraphs), real-world examples (2–3), step-by-step breakdown, common mistakes, pro tips, action items, and summary.

Sections order: outcome-promise, fast-start, framework, then main sections (id: section-1, section-2, … or ch1, ch2, …), then disclaimer at the end. All section titles benefit-driven.

IMAGE PROMPTS: For each main section (ch1, ch2, section-1, etc.), add "imagePrompt": a 1-sentence DALL-E prompt for a relevant, professional illustration. Example: "Professional illustration of [topic], clean modern style, suitable for digital product" – match the section topic.

Return a JSON object with key "sections": array of {"id","title","body","imagePrompt"?}. Use clean HTML in body only. No markdown. Return ONLY the JSON.`,
  };
}

export async function generateProductContent(params: GenerateProductContentParams): Promise<GenerateContentSection[]> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const productName = cleanProductTitle(params.productName) || params.productName || "Product";
  const paramsWithCleanTitle = { ...params, productName };
  const { format = "ebook" } = paramsWithCleanTitle;
  const { prompt, useGpt4, maxTokens } = buildPrompt(paramsWithCleanTitle);

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
  let normalizedFormat = (format || "ebook").toLowerCase().trim();
  if (normalizedFormat === "course outline") normalizedFormat = "course";
  if (normalizedFormat === "checklist pack") normalizedFormat = "checklist";
  if (normalizedFormat === "notion template") normalizedFormat = "notion";
  const ctx = CONTEXT_BLOCK(params);
  const rawChapters = customizationOptions?.numChapters ?? DEFAULT_CHAPTERS;
  const numChapters = Math.min(MAX_CHAPTERS, Math.max(3, Number(rawChapters) || DEFAULT_CHAPTERS));

  const journalPrompts = Math.min(15, Math.max(5, customizationOptions?.journal?.numPrompts ?? 12));
  const courseModules = Math.min(MAX_CHAPTERS, Math.max(2, customizationOptions?.course?.numModules ?? numChapters));
  const numChecklists = Math.min(5, Math.max(2, customizationOptions?.checklist?.numChecklists ?? 4));
  const itemsPerChecklist = Math.min(10, Math.max(5, customizationOptions?.checklist?.itemsPerChecklist ?? 8));
  const numTutorials = Math.min(5, Math.max(2, customizationOptions?.spreadsheet?.numTutorials ?? 4));
  const numDatabases = Math.min(5, Math.max(2, customizationOptions?.notion?.numDatabases ?? 4));

  // Format-specific structure (do not mix; each format has its own template)
  let sectionCountHint: string;
  let formatStructureNote: string;
  switch (normalizedFormat) {
    case "ebook":
    case "guide":
      sectionCountHint = `outcome-promise, fast-start, framework, intro, ${numChapters} chapters, disclaimer`;
      formatStructureNote = "EBOOK/GUIDE: 20-80 pages. Structure: intro, chapters (step-by-step learning), examples, case study, summary, CTA. Teaching/explanatory tone.";
      break;
    case "workbook":
      sectionCountHint = `outcome-promise, fast-start, framework, intro, ${Math.min(8, Math.max(4, numChapters))} prompt/writing sections, disclaimer`;
      formatStructureNote = "WORKBOOK: 15-40 pages. Structure: brief explanation, prompt pages, blank writing spaces, fill-in fields. Minimal theory.";
      break;
    case "notion":
      sectionCountHint = "outcome-promise, fast-start, framework, template-overview, pages-databases, sample-entries, usage-instructions, disclaimer";
      formatStructureNote = "NOTION TEMPLATE: Template name and purpose, all pages and databases with property names and types, how pages link, 3-5 sample entries, step-by-step usage instructions.";
      break;
    case "checklist":
      sectionCountHint = `outcome-promise, fast-start, framework, check1, check2, check3, check4, check5, check6, disclaimer`;
      formatStructureNote = "CHECKLIST PACK: 6 standalone checklists. Each has a unique title, one sentence context, 15-20 checkbox action items. No long explanations.";
      break;
    case "journal":
      sectionCountHint = `outcome-promise, fast-start, framework, welcome, daily1, daily2, daily3, daily4, daily5, daily6, daily7, weekly1, daily8, daily9, daily10, daily11, daily12, daily13, daily14, weekly2, daily15, daily16, daily17, daily18, daily19, daily20, daily21, weekly3, daily22, daily23, daily24, daily25, daily26, daily27, daily28, weekly4, daily29, daily30, monthly-review, disclaimer`;
      formatStructureNote = "JOURNAL: Welcome/how to use, 30 daily entry sections (daily1-daily30), 4 weekly reflection sections (weekly1-weekly4), monthly-review. Prompts specific to sub-topic. Fill-in lines throughout.";
      break;
    case "planner":
      sectionCountHint = "outcome-promise, fast-start, framework, monthly-overview, weekly-spread, daily-task-page, habit-tracker, monthly-reflection, disclaimer";
      formatStructureNote = "PLANNER: Monthly overview table, weekly spread (7 days, morning/midday/evening), daily task page, habit tracker grid (30 days), monthly reflection. Mostly tables and grids. Minimal prose.";
      break;
    case "course":
      sectionCountHint = `outcome-promise, fast-start, framework, ${courseModules} modules, disclaimer`;
      formatStructureNote = "Course outline: mod1, mod2, ... (modules with lessons).";
      break;
    case "spreadsheet":
      sectionCountHint = `outcome-promise, fast-start, overview, setup, tab1, tab2, tab3, formulas, tips, disclaimer`;
      formatStructureNote = "SPREADSHEET TEMPLATE: Each section describes one tab or feature of the spreadsheet. Use <table> with real column headers and sample rows. Show actual formulas (=SUM, =IF, =COUNTIF). Minimal prose — lead with the table structure, then explain each column briefly.";
      break;
    default:
      sectionCountHint = `outcome-promise, fast-start, framework, intro, ${numChapters} sections, disclaimer`;
      formatStructureNote = "Standard sections.";
  }

  const formatExplicit =
    normalizedFormat === "workbook"
      ? "WORKBOOK = intro + prompt/writing sections (ch1, ch2 or prompt1, prompt2)."
      : normalizedFormat === "ebook" || normalizedFormat === "guide"
        ? "EBOOK/GUIDE = intro + chapters (ch1, ch2...). Teaching tone. Do NOT use workbook fill-ins."
        : normalizedFormat === "planner"
          ? "PLANNER = monthly-overview, weekly-breakdown, task-section, goal-tracker, progress-tracker. No chapters. Do NOT use ch1, ch2, intro chapters."
          : normalizedFormat === "journal"
            ? "JOURNAL = daily pages (p1, p2...). Date, prompts, writing space, affirmation. Do NOT use ch1, ch2."
            : normalizedFormat === "checklist"
              ? "CHECKLIST = check1, check2... Tick boxes only. Do NOT use chapters or long content."
              : normalizedFormat === "notion"
                ? "NOTION = dashboard, calendar-view, table-view, revenue-tracker, weekly-planning. Setup guide. Do NOT use ch1, ch2."
                : normalizedFormat === "course"
                  ? "COURSE = mod1, mod2... Modules with lessons. Do NOT use ch1, ch2."
                  : "";

  const prompt = `Product: "${productName}". Niche: ${niche}.
${ctx}

SELECTED FORMAT: "${normalizedFormat}". You MUST use ONLY the structure for this format.
${formatExplicit}
Do NOT output workbook-style sections (intro, ch1, ch2, disclaimer with long chapters) unless format is workbook.

${formatStructureNote}

Return ONLY a JSON object with a "sections" array. Each item: {"id": "string", "title": "string"}. No body, no imagePrompt.
Generate exactly these sections in order (use these exact ids): ${sectionCountHint}
${(normalizedFormat === "ebook" || normalizedFormat === "guide" || normalizedFormat === "workbook")
  ? `CRITICAL: The user requested exactly ${numChapters} main chapter/section(s). You MUST return exactly ${numChapters} chapter sections (ch1${numChapters > 1 ? ` through ch${numChapters}` : ""}). Do not return more than ${numChapters} chapters.`
  : ""}
Section titles must be benefit-driven and match the format. No markdown, no explanation.`;

  const isNonPlanner = normalizedFormat !== "planner";
  if (isNonPlanner) {
    console.log("[DIAG] OUTLINE step 1 — prompt sent to OpenAI", { format: normalizedFormat, promptLength: prompt.length, promptPreview: prompt.slice(0, 200) });
  }

  // Minimal Ebook diagnostic: minimal prompt to isolate parser vs API
  const useMinimalEbook =
    normalizedFormat === "ebook" && process.env.DIAG_EBOOK_MINIMAL === "1";
  const outlinePrompt = useMinimalEbook
    ? `Return ONLY this exact JSON, no other text: {"sections":[{"id":"outcome-promise","title":"Outcome"},{"id":"fast-start","title":"Quick Wins"},{"id":"framework","title":"Framework"},{"id":"intro","title":"Intro"},{"id":"ch1","title":"Chapter 1"},{"id":"disclaimer","title":"Disclaimer"}]}`
    : prompt;

  // gpt-4o-mini: outline/table-of-contents only, low complexity
  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a digital product outline expert. Return only valid JSON with a 'sections' array of {id, title}. No other keys." },
          { role: "user", content: outlinePrompt },
        ],
        temperature: useMinimalEbook ? 0 : 0.6,
        max_tokens: 4000,
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
      useMinimalEbook: !!useMinimalEbook,
    });
    if (useMinimalEbook) {
      console.log("[DIAG] DIAG_EBOOK_MINIMAL: full raw response (parser test) —", raw);
    }
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

  // Enforce requested chapter count so the model cannot override it (e.g. return 8 when user asked for 4)
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
      normalizedFormat !== "spreadsheet");
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
  short: "~500 words",
  medium: "~800 words",
  long: "~1200 words",
};

/** Normalize format for comparison (matches buildPrompt / outline logic). */
function normalizeFormatForGeneration(format: string | undefined): string {
  if (!format || typeof format !== "string") return "ebook";
  const lower = format.toLowerCase().trim();
  if (lower === "course outline" || lower === "course_outline") return "course";
  if (lower === "checklist pack") return "checklist";
  if (lower === "notion template" || lower === "notion_template") return "notion";
  if (lower === "notebook") return "planner";
  return lower;
}

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
  const normalizedFormat = normalizeFormatForGeneration(format);

  const lengthKey = customizationOptions?.contentLength ?? "medium";
  const customWordHint = WORD_HINT_BY_LENGTH[lengthKey];
  const wordHint =
    customWordHint ??
    (normalizedFormat === "workbook"
      ? "500-600 words"
      : normalizedFormat === "ebook"
        ? "800-1000 words"
        : normalizedFormat === "guide"
          ? "600-800 words"
          : "500-800 words");

  const contentStyle = customizationOptions?.contentStyle ?? "text_with_placeholders";
  const wantImagePrompt = contentStyle === "text_with_ai_images";
  const imageLine =
    wantImagePrompt
      ? "For main chapters (ch1, ch2, etc.) or steps, also provide a 1-sentence \"imagePrompt\" for a DALL-E illustration."
      : "Do not include imagePrompt.";

  const fixedSectionIds = ["outcome-promise", "fast-start", "framework", "disclaimer"];
  const isFixedSection = fixedSectionIds.includes(section.id);
  const isLastSection = sectionIndex === totalSections - 1;
  const isMainContentByPosition = sectionIndex >= 3 && sectionIndex < totalSections - 1;

  const isEbookGuideMainSection =
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
    (section.id.startsWith("t") ||
      /^t\d+$/.test(section.id) ||
      /monthly|weekly|task|goal|progress|daily/.test(section.id) ||
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
    (/^p\d+$/.test(section.id) || section.id.startsWith("p") || (!isFixedSection && !isLastSection));

  const isSpreadsheetSection =
    normalizedFormat === "spreadsheet" && !isFixedSection;
  const spreadsheetDifficulty = customizationOptions?.spreadsheet?.difficulty ?? "beginner";
  const spreadsheetIncludePractice = customizationOptions?.spreadsheet?.includePracticeExercises ?? true;

  // EBOOK/GUIDE: 20-80 pages, teaching tone, big headers, callout boxes, step-by-step, case study, summary, CTA
  const ebookGuideInstruction = isEbookGuideMainSection
    ? `This is an EBOOK/GUIDE section. Teaching/explanatory tone. Structure: step-by-step learning, examples, one case study in <div class="callout"> or <div class="example-box">, summary, CTA. Use big headers (<h2>, <h3>), clean structure, callout boxes for key tips. 500-800 words of HTML. No fill-in blanks or workbook exercises.`
    : "";

  // WORKBOOK: 15-40 pages, brief explanation, prompt pages, writing spaces, fill-in fields, minimal theory
  const workbookInstruction = isWorkbookMainSection
    ? `This is a WORKBOOK section. Minimal theory. Structure: very brief explanation (2-3 sentences), then prompt or question, then blank writing space. Use <div class="writing-space"> with lines or ___ for fill-in. Use [FILL IN] or ___ for user input. Optional <ul class="checklist"><li>☐</li></ul>. No long paragraphs — focus on prompts, lines, boxes. 150-300 words.`
    : "";

  // NOTION: Setup guide with Dashboard, Calendar, Table, Revenue tracker, Weekly planning — databases, views, tags, filters, templates
  const notionInstruction = isNotionSection
    ? `This is a NOTION TEMPLATE section. Output a structured setup guide for this component. Include: database properties, views (Calendar/Table/Board as relevant), tags, filters, template blocks. Use <h2>, <h3>, <ul>, <ol>, <p>. Describe step-by-step how to set it up in Notion. 300-500 words. No workbook content.`
    : "";

  // PLANNER: Execution-focused. Calendars, time blocks, goal trackers. No chapters or paragraphs.
  const plannerInstruction = isPlannerSection
    ? `This is a PLANNER section. Execution-focused only. Output LAYOUT only: calendars, time blocks, goal trackers, progress trackers. Use <table> for grids, <th> for day names or time slots, [FILL IN] or ___ for user input. Sections like "Top 3", "To-do", "Notes", date placeholders. NO chapters, NO long paragraphs — only planning structure. 150-350 words of HTML.`
    : "";

  // CHECKLIST PACK: 1-10 pages, minimal, □ only, action items, no long paragraphs
  const checklistInstruction = isChecklistSection
    ? `This is a CHECKLIST PACK section. Minimal design. Output ONLY simple checkbox lists. Format: <ul class="checklist"><li>□ Action item (one short line).</li></ul>. Use □ (empty box). 10-30 items per section. No long paragraphs, no explanations — tick boxes and short action items only.`
    : "";

  const courseInstruction = isCourseModule
    ? `This is a COURSE OUTLINE module. Output: module overview (1–2 paragraphs), <h3>Learning objectives</h3><ul>...</ul>, <h3>Lessons</h3><ol><li>Lesson title: short description.</li></ol>, <h3>Resources</h3>, key takeaways. Use benefit-driven lesson titles. 500–700 words of HTML.`
    : "";

  // SPREADSHEET: Show actual table structure with column headers, sample rows, and real formulas.
  const spreadsheetInstruction = isSpreadsheetSection
    ? `This is a SPREADSHEET TEMPLATE section (difficulty: ${spreadsheetDifficulty}). Output the actual spreadsheet structure for this tab/feature. Lead with a <table> showing real column headers (e.g. Date, Category, Amount, Notes) and 3-5 sample data rows with realistic values. After the table, briefly explain what each column does in 1-2 sentences each. Include at least 2 real formula examples relevant to this tab — ${spreadsheetDifficulty === "beginner" ? "keep formulas simple: =SUM(), =AVERAGE(), =COUNT()" : spreadsheetDifficulty === "intermediate" ? "use mid-level formulas: =IF(), =COUNTIF(), =VLOOKUP()" : "use advanced formulas: =ARRAYFORMULA(), =QUERY(), =INDEX(MATCH())"} — use <code> for formulas. Keep prose minimal — the table and formulas ARE the content.${spreadsheetIncludePractice ? " End with a short 'Practice Exercise' box: one task the reader can do using this tab." : ""} 300-500 words of HTML.`
    : "";

  // JOURNAL: Date field, 2-3 reflection prompts, writing space, affirmation. Aesthetic, whitespace, mindset tone.
  const journalInstruction = isJournalPrompt
    ? `This is a JOURNAL page. Repeating daily structure. Include: (1) Date field: "Date: _______________", (2) 2-3 reflection prompts as <h3> or <p>, (3) <div class="writing-space"> for writing space (use lines or blank area), (4) Affirmation section. Mindset/reflective tone. Lots of whitespace. Use minimal HTML. No long paragraphs.`
    : "";

  const formatSpecificRequirement =
    ebookGuideInstruction ||
    workbookInstruction ||
    notionInstruction ||
    plannerInstruction ||
    checklistInstruction ||
    courseInstruction ||
    journalInstruction ||
    spreadsheetInstruction;
  const baseRequirements = formatSpecificRequirement
    ? formatSpecificRequirement
    : `${wordHint} of HTML. Use <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li>. No markdown. Include hook, main content, examples, action items, summary where appropriate.`;

  const formatRuleLine =
    normalizedFormat === "workbook"
      ? "Format is WORKBOOK: brief explanation, prompts, writing spaces, fill-in fields. Minimal theory."
      : normalizedFormat === "ebook" || normalizedFormat === "guide"
        ? "Format is EBOOK/GUIDE: teaching tone, step-by-step, callout boxes. No fill-ins or workbook exercises."
        : normalizedFormat === "planner"
          ? "Format is PLANNER: layouts only (calendars, time blocks, trackers). No chapters or paragraphs."
          : normalizedFormat === "journal"
            ? "Format is JOURNAL: date, reflection prompts, writing space, affirmation. Mindset tone."
            : normalizedFormat === "checklist"
              ? "Format is CHECKLIST: tick boxes (□) and short action items only. No paragraphs."
              : normalizedFormat === "notion"
                ? "Format is NOTION: setup guide for databases/views. No workbook content."
                : normalizedFormat === "course"
                  ? "Format is COURSE: module with lessons, objectives, resources."
                  : normalizedFormat === "spreadsheet"
                    ? "Format is SPREADSHEET: show actual table structure with column headers, sample data rows, and real formulas. Lead with <table>. Minimal prose."
                    : "";

  const prompt = `Product: "${productName}". Niche: ${niche}.
${ctx}

SELECTED FORMAT: "${normalizedFormat}". You MUST write content for this format only. ${formatRuleLine}
Do NOT write workbook-style content (long explanations, fill-in prompts, writing spaces) unless format is workbook.

Write ONLY the content for this section (section ${sectionIndex + 1} of ${totalSections}):
- id: "${section.id}"
- title: "${section.title}"

Requirements: ${baseRequirements}
${imageLine}

Return ONLY valid JSON: {"body": "<p>...</p>", "imagePrompt": "optional one sentence only if requested"}. No code fences.`;

  const isNonPlannerSection = normalizedFormat !== "planner";
  if (isNonPlannerSection) {
    console.log("[DIAG] SECTION step 1 — prompt sent to OpenAI", { format: normalizedFormat, sectionId: section.id, promptLength: prompt.length });
  }

  const systemMessage =
    normalizedFormat === "checklist"
      ? "You write checklist pack content. Output ONLY checkbox lists (□) and short action items. No long paragraphs. Return only valid JSON with body and optional imagePrompt. No markdown."
      : normalizedFormat === "planner"
        ? "You write planner layout content. Output ONLY planning structure: calendars, time blocks, trackers, tables. No chapters or paragraphs. Return only valid JSON with body and optional imagePrompt. No markdown."
        : normalizedFormat === "journal"
          ? "You write journal page content. Output date field, reflection prompts, writing space, affirmation. Mindset tone, lots of whitespace. Return only valid JSON with body and optional imagePrompt. No markdown."
          : normalizedFormat === "notion"
            ? "You write Notion setup guide content. Describe databases, views, filters, templates. No workbook-style content. Return only valid JSON with body and optional imagePrompt. No markdown."
            : normalizedFormat === "spreadsheet"
              ? "You write spreadsheet template content. Lead every section with an HTML <table> showing real column headers and sample data rows. Include actual formula examples using <code>. Minimal prose — the table structure IS the content. Return only valid JSON with body and optional imagePrompt. No markdown."
              : SYSTEM_PREMIUM;

  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini", // faster + higher rate limits → prevents section timeouts on 10-section products
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: MAX_SECTION_TOKENS,
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
