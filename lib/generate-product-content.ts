import OpenAI from "openai";
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
  hookTexts: string[];
  ctaTexts: string[];
  customizationOptions?: CustomizationOptions;
};

const SYSTEM_PREMIUM =
  "You are an expert digital product creator. Your content must be comprehensive, in-depth, and valuable—the kind of content customers would gladly pay for. This is premium content users will pay $37–97 for; make it extremely valuable and comprehensive. Write content that fills full pages. Include extensive details, real-world examples, and actionable advice. Never write short or superficial sections; every section must meet the minimum word count. Return only valid JSON with a 'sections' array. Output HTML only in body fields—no markdown, no code fences, no explanation.";

const CONTEXT_BLOCK = (params: GenerateProductContentParams) =>
  `PRODUCT CONTEXT:
- Name: "${params.productName}"
- What's included: ${params.productIncluded || "N/A"}
- Why it sells / audience: ${params.productWhy || "N/A"}
${params.productDescription ? `- Description: ${params.productDescription}` : ""}
NICHE: ${params.niche || "General audience"}
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
  let normalizedFormat = (format || "ebook").toLowerCase().trim();
  if (normalizedFormat === "course outline") normalizedFormat = "course";
  if (normalizedFormat === "checklist pack") normalizedFormat = "checklist";
  if (normalizedFormat === "notion template") normalizedFormat = "notion";
  const ctx = CONTEXT_BLOCK(params);

  if (normalizedFormat === "workbook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a WORKBOOK (15-40 pages) titled "${productName}" for the ${niche} niche.

WORKBOOK FORMAT ONLY: Interactive PDF with writing spaces. Structure: brief explanation, prompt pages, blank writing spaces, fill-in fields (underscores/boxes). Layout: big white spaces, lines, boxes, check prompts. MINIMAL THEORY — no long teaching paragraphs.

${ctx}

Each main section (intro, prompt1, prompt2, ch1, ch2...): (1) Very brief explanation (2-3 sentences), (2) A prompt or question, (3) <div class="writing-space"> with ___ or lines for writing, (4) Optional <ul class="checklist"><li>☐</li></ul>. Use [FILL IN] or ___ for user input. No 500-word paragraphs.

Sections: outcome-promise, fast-start, framework, intro, then 4-8 prompt/writing sections (ids: prompt1, prompt2... or ch1, ch2...), disclaimer. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. Body = HTML with writing-space divs, ___ fill-ins, minimal text. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "ebook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create an EBOOK/GUIDE (20-80 pages) titled "${productName}" for the ${niche} niche.

EBOOK FORMAT: PDF, teaching/explanatory tone. Structure: cover (title only), intro, chapters with step-by-step learning, examples, case study, summary, CTA. Layout: big headers, clean margins, callout boxes (<div class="callout">). Do NOT use workbook fill-ins or writing spaces.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

CHAPTER STRUCTURE: Step-by-step learning, real examples, one case study in <div class="example-box"> or <div class="callout">, summary, CTA. Use <h2>, <h3> for big headers. 500-800 words per chapter. ${htmlRules}

Sections: outcome-promise, fast-start, framework, intro, ch1, ch2, ch3, ch4, ch5, ch6, disclaimer. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"...","imagePrompt":"..."}]}. No markdown.`,
    };
  }

  if (normalizedFormat === "guide") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a GUIDE (20-80 pages) titled "${productName}" for the ${niche} niche.

GUIDE FORMAT: Same as ebook — PDF, teaching/explanatory tone. Structure: intro, chapters with step-by-step learning, examples, case study, summary, CTA. Layout: big headers, clean margins, callout boxes. Use <div class="callout"> for key tips. No workbook fill-ins.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

Sections: outcome-promise, fast-start, framework, intro, step1, step2, step3, step4, step5, step6, disclaimer. Each step: <h2>Step N: Title</h2>, instructions, examples, callout. 500-700 words per step. ${htmlRules} Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}.`,
    };
  }

  if (normalizedFormat === "checklist" || normalizedFormat === "checklist pack") {
    return {
      useGpt4: true,
      maxTokens: 8000,
      prompt: `Create a CHECKLIST PACK (1-10 pages) for "${productName}" (${niche} niche).

CHECKLIST PACK FORMAT ONLY: Minimal design. Tick boxes only. Simple checkbox lists using □ (empty box) with short action items. NO long paragraphs — only <ul class="checklist"><li>□ Action item.</li></ul>. 10-30 items per section.

${ctx}

Sections: outcome-promise, fast-start, framework, check1, check2, check3, check4, check5, disclaimer. Each check section: ONLY <ul class="checklist"><li>□ one short action line</li></ul>. No prose. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "journal") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a JOURNAL for "${productName}" (${niche} niche).

JOURNAL FORMAT: Aesthetic, lots of whitespace. Repeating daily structure. Each page: (1) Date field, (2) 2-3 reflection prompts, (3) writing space, (4) affirmation section. Mindset/reflective tone. No long essays.

${ctx}
${SELLABLE_STRUCTURE}

Each content section (p1, p2, ...): Include "Date: _______________", 2-3 reflection prompts, <div class="writing-space"> for writing, and an affirmation. Use minimal HTML. Lots of whitespace. Return ONLY JSON: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start",...},{"id":"framework",...},{"id":"p1",...},...,{"id":"disclaimer",...}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "course" || normalizedFormat === "course outline") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a COURSE OUTLINE for "${productName}" (${niche} niche).

Generate a course with 8–12 modules. Each module 500–700 words: module overview, 5–8 lesson titles, learning objectives, resources, and assignments. This is premium content users will pay $37–97 for.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

MODULE STRUCTURE (every module must follow this):
1. Module overview (1–2 paragraphs)
2. Learning objectives (3–5 bullet points in <ul>)
3. Lesson breakdown: 5–8 lessons per module – each with title and 2–4 sentences (use <h3>Lessons</h3><ol><li>Lesson title: description.</li></ol>). Module and lesson titles must be benefit-driven.
4. Resources / materials
5. Assignments or activities
6. Key takeaways (summary)

Format: <h2>Module 1: Title</h2><h3>Lessons</h3><ol><li>Lesson 1: Description.</li></ol><h3>Learning objectives</h3><ul>...</ul><h3>Resources</h3>... ${htmlRules}

IMAGE PROMPTS: For each module (mod1, mod2, …), add "imagePrompt": a 1-sentence DALL-E prompt for an educational illustration. Example: "Educational illustration of [topic], clean tech style" – match the module topic.

Generate sections in this order:
- outcome-promise, fast-start, framework (as in SELLABLE CONTENT)
- 8–12 modules (ids: mod1, mod2, …). Each module body 500–700 words of HTML. Module titles benefit-driven.
- disclaimer at the end.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"mod1","title":"Module 1: ...","body":"...","imagePrompt":"Educational illustration of [topic], clean tech style"},...,{"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
    };
  }

  if (normalizedFormat === "planner" || normalizedFormat === "notebook") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a PLANNER for "${productName}" (${niche} niche).

PLANNER FORMAT ONLY: Execution-focused. Structure: monthly overview, weekly breakdown, task sections, goal trackers, progress trackers. Layout: calendars, time blocks, goal tracking. NO chapters, NO long paragraphs — only planning layouts.

${ctx}
${SELLABLE_STRUCTURE}

Sections: outcome-promise, fast-start, framework, monthly-overview, weekly-breakdown, task-section, goal-tracker, progress-tracker, disclaimer. Each layout section: <table> for grids, <th> for days/times, [FILL IN] or ___. Time blocks, date placeholders, "Top 3", "To-do", "Notes". No prose. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. ${htmlRules}`,
    };
  }

  if (normalizedFormat === "spreadsheet") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Generate a comprehensive step-by-step tutorial for creating a ${niche} spreadsheet in Microsoft Excel or Google Sheets. Product: "${productName}".

${ctx}

For each section, write 600–800 words covering:
1. What this section accomplishes
2. Exact step-by-step instructions (e.g., "Click cell A1, type 'Date'")
3. Formulas to use (e.g., =SUM(B2:B10), =AVERAGE(C:C))
4. Formatting tips (borders, colors, conditional formatting)
5. Advanced formulas (VLOOKUP, IF statements, COUNTIF, etc.)
6. Creating charts and graphs from the data
7. Setting up navigation between sheets (hyperlinks, tabs)
8. Adding data validation (dropdowns, date pickers)
9. Conditional formatting rules (highlight cells based on values)
10. Protecting cells/sheets
11. Creating print-friendly layouts
12. Common mistakes to avoid
13. Screenshot descriptions (what it should look like)

IMAGE PROMPTS: For each section, add "imagePrompt": a 1-sentence DALL-E prompt. Example: "Professional screenshot-style illustration of organized spreadsheet layout" – match the section topic.

Write in tutorial format with clear instructions. Use HTML tags: <h2>, <h3>, <p>, <ul>, <ol>, <strong>.

Example structure:
<h2>Setting Up Your Budget Tracker</h2>
<p>In this section, you'll create the foundation of your budget spreadsheet...</p>
<h3>Step 1: Create Column Headers</h3>
<ol>
  <li>Click on cell A1 and type 'Date'</li>
  <li>Click on cell B1 and type 'Category'</li>
  <li>Click on cell C1 and type 'Amount'</li>
</ol>
<h3>Step 2: Add Formulas</h3>
<p>In cell D2, enter this formula: <strong>=SUM(C2:C100)</strong></p>
<h3>Step 3: Add Advanced Formulas</h3>
<p>In cell E2, create a conditional formula: <strong>=IF(C2>1000,"Over Budget","Within Budget")</strong></p>
<p>This will automatically flag expenses that exceed your budget.</p>
<h3>Step 4: Create a Summary Chart</h3>
<ol>
  <li>Select cells A1:C10</li>
  <li>Click Insert > Chart > Pie Chart</li>
  <li>Customize colors and labels in the Chart Design tab</li>
</ol>

Make each section 600–800 words with comprehensive Excel instruction. Include "imagePrompt" for each section: a 1-sentence DALL-E prompt for a spreadsheet screenshot-style illustration. Return 4–8 sections as valid JSON: {"sections":[{"id":"s1","title":"Section title","body":"<h2>...</h2><p>...</p>","imagePrompt":"Professional spreadsheet layout illustration"}]}. No markdown, HTML only in body.`,
    };
  }

  if (normalizedFormat === "notion") {
    return {
      useGpt4: true,
      maxTokens: 12000,
      prompt: `Create a NOTION TEMPLATE setup guide for "${productName}" (${niche} niche).

NOTION FORMAT ONLY: Structured Notion setup guide. Include these components: Dashboard, Calendar view, Table view, Revenue tracker, Weekly planning template. For each: databases, views, tags, filters, templates. Step-by-step how to set up in Notion.

${ctx}

Sections (use these ids): dashboard (Dashboard overview), calendar-view (Calendar view), table-view (Table view), revenue-tracker (Revenue tracker), weekly-planning (Weekly planning template), disclaimer. Each section body: HTML describing properties, views, filters, template blocks. 300-500 words per section. Return ONLY JSON: {"sections":[{"id":"...","title":"...","body":"..."}]}. No workbook content.`,
    };
  }

  // Default: ebook-style with full length (templates, generic content)
  return {
    useGpt4: true,
    maxTokens: 16000,
    prompt: `Generate full CONTENT for "${productName}" (${niche} niche). Format: ${format}.

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
  const { format = "ebook" } = params;
  const { prompt, useGpt4, maxTokens } = buildPrompt(params);

  // gpt-4o when useGpt4: full product section content in one shot (quality); gpt-4o-mini: cost-saving fallback
  const completion = await openai.chat.completions.create({
    model: useGpt4 ? "gpt-4o" : "gpt-4o-mini",
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
      sectionCountHint = "dashboard, calendar-view, table-view, revenue-tracker, weekly-planning, disclaimer";
      formatStructureNote = "NOTION TEMPLATE: Structured setup guide. Include: Dashboard, Calendar view, Table view, Revenue tracker, Weekly planning template. Databases, views, tags, filters, templates.";
      break;
    case "checklist":
      sectionCountHint = `outcome-promise, fast-start, framework, check1, check2, check3, check4, check5, disclaimer`;
      formatStructureNote = "CHECKLIST PACK: 1-10 pages. Minimal design. Tick boxes (□) and action items only. No long paragraphs.";
      break;
    case "journal":
      sectionCountHint = `outcome-promise, fast-start, framework, p1, p2, p3, p4, p5, p6, p7, p8, disclaimer`;
      formatStructureNote = "JOURNAL: Repeating daily structure. Each page: Date field, 2-3 reflection prompts, writing space, affirmation section. Mindset/reflective tone. Lots of whitespace.";
      break;
    case "planner":
      sectionCountHint = "outcome-promise, fast-start, framework, monthly-overview, weekly-breakdown, task-section, goal-tracker, progress-tracker, disclaimer";
      formatStructureNote = "PLANNER: Execution-focused. Structure: monthly overview, weekly breakdown, task sections, goal trackers, progress trackers. Calendars, time blocks. No chapters or paragraphs.";
      break;
    case "course":
      sectionCountHint = `outcome-promise, fast-start, framework, ${courseModules} modules, disclaimer`;
      formatStructureNote = "Course outline: mod1, mod2, ... (modules with lessons).";
      break;
    case "spreadsheet":
      sectionCountHint = `step1, step2, step3, step4, step5, step6, disclaimer`;
      formatStructureNote = "Spreadsheet tutorial: step-by-step sections.";
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

  // gpt-4o-mini: outline/table-of-contents only, low complexity
  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a digital product outline expert. Return only valid JSON with a 'sections' array of {id, title}. No other keys." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 4000,
      }),
    {
      onRetry: (attempt, delayMs) =>
        console.warn(`[generate-product-content] Outline 429/5xx, retry ${attempt} in ${delayMs / 1000}s`),
    }
  );
  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonStr) as { sections?: Array<{ id?: string; title?: string }> };
  let sections: OutlineSection[] = (parsed.sections || []).map((s, i) => ({
    id: typeof s.id === "string" && s.id ? s.id : `section-${i + 1}`,
    title: typeof s.title === "string" && s.title ? s.title : `Section ${i + 1}`,
  }));
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
    journalInstruction;
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

  const systemMessage =
    normalizedFormat === "checklist"
      ? "You write checklist pack content. Output ONLY checkbox lists (□) and short action items. No long paragraphs. Return only valid JSON with body and optional imagePrompt. No markdown."
      : normalizedFormat === "planner"
        ? "You write planner layout content. Output ONLY planning structure: calendars, time blocks, trackers, tables. No chapters or paragraphs. Return only valid JSON with body and optional imagePrompt. No markdown."
        : normalizedFormat === "journal"
          ? "You write journal page content. Output date field, reflection prompts, writing space, affirmation. Mindset tone, lots of whitespace. Return only valid JSON with body and optional imagePrompt. No markdown."
          : normalizedFormat === "notion"
            ? "You write Notion setup guide content. Describe databases, views, filters, templates. No workbook-style content. Return only valid JSON with body and optional imagePrompt. No markdown."
            : SYSTEM_PREMIUM;

  // gpt-4o: quality matters for long-form section content; max_tokens capped for speed
  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o",
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
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonStr) as { body?: string; imagePrompt?: string };
  const body = typeof parsed.body === "string" && parsed.body ? parsed.body : "";
  const imagePrompt =
    typeof parsed.imagePrompt === "string" && parsed.imagePrompt.trim() ? parsed.imagePrompt.trim() : undefined;
  return { body, imagePrompt };
}
