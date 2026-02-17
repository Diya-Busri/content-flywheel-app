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
  const normalizedFormat = (format || "ebook").toLowerCase().trim();
  const ctx = CONTEXT_BLOCK(params);

  if (normalizedFormat === "workbook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a COMPREHENSIVE INTERACTIVE WORKBOOK titled "${productName}" for the ${niche} niche.

Write 500–700 words per section. Each section should fill 2–3 full PDF pages. Be extremely detailed with examples, stories, and actionable advice. This is a premium product people will pay $37–97 for.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

SECTION STRUCTURE (every chapter must follow this exactly):

1. Hook (2–3 sentences) – grab attention and set up the section
2. Context (1 paragraph) – why this section matters for the reader
3. Main teaching (3–4 paragraphs) – core concepts with embedded examples
4. Real-world example (1 detailed scenario in <div class="example-box"> – a full story/case study)
5. Common mistakes (3–5 bullet points in <ul>)
6. Action steps (3–5 numbered steps in <ol>)
7. Reflection questions (2–3 questions in <ol>)
8. Optional: Action checklist (<ul class="checklist"> with ☐) and/or notes space (<div class="notes-space">)

Use <div class="chapter-intro">, <div class="example-box">, <div class="exercise-box"> (for [FILL IN] exercises if needed), <ul class="checklist">, <div class="notes-space">. Use <table> for worksheets where appropriate. ${htmlRules}

Generate sections in this order:
- outcome-promise, fast-start, framework (as defined in SELLABLE CONTENT above)
- 1 introduction (id: "intro"): Welcome, how to use the workbook, what they'll achieve, materials needed. 300–400 words.
- 8–12 main chapters (ids: ch1, ch2, …). EACH chapter body MUST be 500–700 words of HTML. Use benefit-driven chapter titles.
- disclaimer (id: "disclaimer") at the end: short empowering statement.

IMAGE PROMPTS: For each main chapter (ch1, ch2, …), add "imagePrompt": a 1-sentence DALL-E prompt for a relevant illustration. Example: "Clean minimalist illustration of goal planning and achievement, journal style" – match the chapter topic.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"intro","title":"...","body":"..."},{"id":"ch1","title":"...","body":"...","imagePrompt":"Professional illustration of [topic], journal style"},...,{"id":"disclaimer","title":"...","body":"..."}]}. No markdown, no code fences.`,
    };
  }

  if (normalizedFormat === "ebook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a professional, full-content EBOOK titled "${productName}" for the ${niche} niche.

CRITICAL: This is a premium digital product worth $47–97. Each chapter must FILL 2–3 full PDF pages. Never write sparse or brief content. Every chapter must have substantial, detailed content.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

CHAPTER STRUCTURE (every main chapter ch1, ch2, … MUST follow this):
1. Introduction paragraph (2–3 sentences) – hook and set up
2. Main content: 4–6 detailed paragraphs with 3–5 subsections using <h3>. EACH subsection:
   - 2–3 full paragraphs of detailed explanation (4–5 sentences each)
   - Step-by-step instructions where relevant
   - Real examples, tips, action items, and best practices
   - Use <ul>, <ol> for lists; <strong> for emphasis
3. Case study (1 detailed real-world scenario in <div class="example-box">)
4. Key takeaways (2–3 bullet points)
5. Practical action steps (2–4 things the reader can do next)

MINIMUM 1200–1500 words per main chapter. Make it practical, engaging, and valuable. Use <h2> for chapter title, <h3> for subsections. Include stories, research, expert quotes, and concrete examples. ${htmlRules}

IMAGE PROMPTS: For each main chapter (ch1, ch2, …), add "imagePrompt": a 1-sentence DALL-E prompt for a relevant, professional illustration. Example: "Professional illustration of [topic], clean modern style, suitable for ebook" – match the chapter topic (e.g., "AR Art Creation Toolkit" chapter → "Digital art created with augmented reality tools, modern creative workspace").

Generate sections in this order:
- outcome-promise, fast-start, framework (as defined above)
- intro (id: "intro", 500–600 words): Welcome, how to use the ebook, what they'll achieve
- 6–8 main chapters (ids: ch1, ch2, …). Each chapter: 1200–1500 words + imagePrompt. Benefit-driven titles.
- disclaimer (id: "disclaimer") at the end

Return ONLY valid JSON: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"intro","title":"...","body":"..."},{"id":"ch1","title":"...","body":"...","imagePrompt":"Professional illustration of [topic], clean modern style"},...,{"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
    };
  }

  if (normalizedFormat === "guide") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a step-by-step GUIDE titled "${productName}" for the ${niche} niche.

Generate 600–800 words per step. Each step must include: step number, what you'll accomplish, detailed instructions, tips, warnings, and examples. This is premium content users will pay $37–97 for.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

STEP STRUCTURE (every step must follow this):
- Use <h2>Step N: Title</h2> for each step heading (e.g. <h2>Step 1: Set Up Your Workspace</h2>). Step titles must be benefit-driven (e.g. "Step 1: Build Your Wealth Engine" not "Step 1: Set Up Savings").
- What you'll accomplish: 1–2 sentences at the start.
- Detailed instructions: numbered lists <ol> with 5–10 sub-steps; full explanations per step.
- Tips: <ul> or <div class="action-box"> with best practices.
- Warnings: bullet list of common mistakes to avoid.
- Examples: 1–2 concrete examples or scenarios.

Use <h3> for "What you'll accomplish", "Instructions", "Tips", "Warnings", "Examples". Use <ol> for numbered steps, <ul> for bullets. Use <div class="action-box"> for key callouts. ${htmlRules}

IMAGE PROMPTS: For each step (step1, step2, …), add "imagePrompt": a 1-sentence DALL-E prompt for a step illustration. Example: "Step-by-step tutorial illustration of [action], clean professional style" – match the step topic.

Generate sections in this order:
- outcome-promise, fast-start, framework (as defined in SELLABLE CONTENT above)
- 6–12 steps (ids: step1, step2, …). Each step body MUST be 600–800 words of HTML. Step titles benefit-driven.
- disclaimer (id: "disclaimer") at the end.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"step1","title":"Step 1: ...","body":"...","imagePrompt":"Tutorial illustration of [topic], professional style"},...,{"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
    };
  }

  if (normalizedFormat === "checklist" || normalizedFormat === "checklist pack") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create CHECKLIST PACK content for "${productName}" (${niche} niche).

Generate 30–50 checklist items per section. Each item: ☐ (checkbox) plus a 1–2 sentence description. Group items into categories. This is premium content users will pay $37–97 for.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

REQUIREMENTS:
- First include: outcome-promise, fast-start, framework, then disclaimer at the end (as in SELLABLE CONTENT).
- 5–8 checklist sections (themed). Each section title benefit-driven. Each section = 30–50 actionable items.
- Each item: ☐ followed by 1–2 sentence description (what to do and why/how).
- Group into categories using <h3> within a section (e.g. Pre-launch, Daily, Weekly, Monthly).
- Format body as HTML: <ul class="checklist"><li>☐ Item description (1–2 sentences).</li></ul>
- Mix of: pre-launch, daily, weekly, monthly, and niche-specific checklists. Descriptions must be actionable and clear. ${htmlRules}

IMAGE PROMPTS: For each checklist section (check1, check2, …), add "imagePrompt": a 1-sentence DALL-E prompt for a relevant icon/illustration. Example: "Simple icon set for [topic], flat design style" – match the checklist theme.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"check1","title":"...","body":"...","imagePrompt":"Simple icon set for [theme], flat design"},...,{"id":"disclaimer","title":"...","body":"..."}]}. 30–50 items per checklist. No markdown, HTML only.`,
    };
  }

  if (normalizedFormat === "journal") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a JOURNAL PROMPT PACK for "${productName}" (${niche} niche).

Generate 50–75 thoughtful journal prompts. Each prompt: a main question plus 2–3 follow-up questions. This is premium content users will pay $37–97 for.

${ctx}
${SELLABLE_STRUCTURE}

REQUIREMENTS:
- First include: outcome-promise, fast-start, framework; end with disclaimer (as in SELLABLE CONTENT).
- 50–75 prompt sections. Each section = one prompt (one page in the PDF).
- Each prompt: "title" = main question (1 sentence); "body" = 2–3 follow-up questions in HTML.
- Format: <div class="prompt"><h3>Main prompt question?</h3><p>Follow-up 1?</p><p>Follow-up 2?</p></div>
- Themes: morning prompts, evening prompts, weekly reflection, goal-setting, gratitude, self-discovery, niche-specific reflection.
- Deep and thought-provoking. Variety: "What if...", "Describe a time...", "List three...", "How might you...". ${htmlRules}

IMAGE PROMPTS: For every 5–8 prompt sections, add "imagePrompt" to one section: a 1-sentence DALL-E prompt. Example: "Calm minimalist illustration of morning journaling and coffee, warm tones" – match the journal theme.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"p1","title":"...","body":"...","imagePrompt":"Calm minimalist illustration of journaling, warm tones"},...,{"id":"disclaimer","title":"...","body":"..."}]}. 50–75 prompt sections. No markdown, HTML only.`,
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
      maxTokens: 16000,
      prompt: `Create PLANNER/NOTEBOOK content for "${productName}" (${niche} niche).

Generate 30 planning templates with examples. Include: daily pages, weekly spreads, goal trackers, habit trackers. Each template has headers and example entries so users see how to fill it in. This is premium content users will pay $37–97 for.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

REQUIREMENTS:
- First include: outcome-promise, fast-start, framework; end with disclaimer (as in SELLABLE CONTENT).
- 30 template sections. Template titles benefit-driven (e.g. "Daily Wealth-Building Schedule" not "Daily Schedule"). Include: daily pages (schedule, priorities, reflection), weekly spreads (goals, schedule, review), monthly overviews, goal trackers, habit trackers, gratitude log, idea capture.
- Each template body: brief how-to (1–2 sentences), then the template structure with example entries in light gray or placeholder text (e.g. "9:00 AM – Morning routine", "Goal 1: Example goal"). Use <table> for grids, <ul>/<li> for lists. Use [FILL IN] or ___ where the user writes.
- Format with clear headers and example text. Every template should have 3–5+ example rows or entries so the layout is obvious. ${htmlRules}

IMAGE PROMPTS: For every 3–5 template sections, add "imagePrompt" to one: a 1-sentence DALL-E prompt. Example: "Inspirational planner layout illustration, minimalist warm tones" – match the template theme.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"t1","title":"...","body":"...","imagePrompt":"Inspirational planner layout, minimalist style"},...,{"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
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
      useGpt4: false,
      maxTokens: 16000,
      prompt: `Outline a NOTION product for "${productName}" (${niche} niche). Describe pages and databases.

${ctx}

IMAGE PROMPTS: For each section, add "imagePrompt": a 1-sentence DALL-E prompt. Example: "Professional screenshot-style illustration of Notion database layout, organized and clean" – match the page/database type.

Return 4–8 sections. Each section = one page or database: "title" = page/database name, "body" = HTML description of properties, views, and content, "imagePrompt" = DALL-E prompt. Return ONLY JSON: {"sections":[{"id":"p1","title":"...","body":"...","imagePrompt":"..."}]}.`,
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
  const normalizedFormat = (format || "ebook").toLowerCase().trim();
  const ctx = CONTEXT_BLOCK(params);
  const numChapters = Math.min(MAX_CHAPTERS, Math.max(3, customizationOptions?.numChapters ?? DEFAULT_CHAPTERS));

  const journalPrompts = Math.min(15, Math.max(5, customizationOptions?.journal?.numPrompts ?? 12));
  const courseModules = Math.min(MAX_CHAPTERS, Math.max(2, customizationOptions?.course?.numModules ?? numChapters));
  const numChecklists = Math.min(5, Math.max(2, customizationOptions?.checklist?.numChecklists ?? 4));
  const itemsPerChecklist = Math.min(10, Math.max(5, customizationOptions?.checklist?.itemsPerChecklist ?? 8));
  const numTutorials = Math.min(5, Math.max(2, customizationOptions?.spreadsheet?.numTutorials ?? 4));
  const numDatabases = Math.min(5, Math.max(2, customizationOptions?.notion?.numDatabases ?? 4));

  let sectionCountHint =
    normalizedFormat === "workbook"
      ? `outcome-promise, fast-start, framework, intro, ${numChapters} main chapters, disclaimer`
      : normalizedFormat === "ebook" || normalizedFormat === "guide"
        ? `outcome-promise, fast-start, framework, intro, ${numChapters} chapters, disclaimer`
        : normalizedFormat === "journal"
          ? `outcome-promise, fast-start, framework, ${journalPrompts} prompts, disclaimer`
          : normalizedFormat === "course"
            ? `outcome-promise, fast-start, framework, ${courseModules} modules, disclaimer`
            : normalizedFormat === "planner"
              ? "outcome-promise, fast-start, framework, 12 templates, disclaimer"
              : normalizedFormat === "checklist"
                ? `${numChecklists} checklists (each with ${itemsPerChecklist} items), disclaimer`
                : normalizedFormat === "spreadsheet"
                  ? `${numTutorials} tutorials, disclaimer`
                  : normalizedFormat === "notion"
                    ? `${numDatabases} databases/views, disclaimer`
                    : `outcome-promise, fast-start, framework, ${numChapters} sections, disclaimer`;
  sectionCountHint = `Generate exactly these sections in order: ${sectionCountHint}.`;

  const prompt = `Product: "${productName}". Format: ${format}. Niche: ${niche}.
${ctx}

Return ONLY a JSON object with a "sections" array. Each item: {"id": "string", "title": "string"}. No body, no imagePrompt.
Use standard ids where applicable: outcome-promise, fast-start, framework, intro, ch1/ch2/... or step1/step2/... or mod1/mod2/... or p1/p2/..., disclaimer at end.
${sectionCountHint} Section titles must be benefit-driven. No markdown, no explanation.`;

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
  const sections: OutlineSection[] = (parsed.sections || []).map((s, i) => ({
    id: typeof s.id === "string" && s.id ? s.id : `section-${i + 1}`,
    title: typeof s.title === "string" && s.title ? s.title : `Section ${i + 1}`,
  }));
  if (sections.length === 0) throw new Error("AI returned no outline sections");
  return sections;
}

const WORD_HINT_BY_LENGTH: Record<string, string> = {
  short: "~500 words",
  medium: "~800 words",
  long: "~1200 words",
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

  const lengthKey = customizationOptions?.contentLength ?? "medium";
  const customWordHint = WORD_HINT_BY_LENGTH[lengthKey];
  const wordHint =
    customWordHint ??
    (format?.toLowerCase() === "workbook"
      ? "500-600 words"
      : format?.toLowerCase() === "ebook"
        ? "800-1000 words"
        : format?.toLowerCase() === "guide"
          ? "600-800 words"
          : "500-800 words");

  const contentStyle = customizationOptions?.contentStyle ?? "text_with_placeholders";
  const wantImagePrompt = contentStyle === "text_with_ai_images";
  const imageLine =
    wantImagePrompt
      ? "For main chapters (ch1, ch2, etc.) or steps, also provide a 1-sentence \"imagePrompt\" for a DALL-E illustration."
      : "Do not include imagePrompt.";

  const prompt = `Product: "${productName}". Format: ${format}. Niche: ${niche}.
${ctx}

Write ONLY the content for this section (section ${sectionIndex + 1} of ${totalSections}):
- id: "${section.id}"
- title: "${section.title}"

Requirements: ${wordHint} of HTML. Use <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li>. No markdown. Include hook, main content, examples, action items, summary where appropriate.
${imageLine}

Return ONLY valid JSON: {"body": "<p>...</p>", "imagePrompt": "optional one sentence only if requested"}. No code fences.`;

  // gpt-4o: quality matters for long-form section content; max_tokens capped for speed
  const completion = await withRetry429(
    () =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PREMIUM },
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
