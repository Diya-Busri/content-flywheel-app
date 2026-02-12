import OpenAI from "openai";

export type GenerateContentSection = { id: string; title: string; body: string };

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export type GenerateProductContentParams = {
  productName: string;
  productDescription?: string;
  productIncluded?: string;
  productWhy?: string;
  niche: string;
  format: string;
  hookTexts: string[];
  ctaTexts: string[];
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
${params.ctaTexts?.length ? `CTAs: ${params.ctaTexts.join(" | ")}` : ""}`;

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

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"intro","title":"...","body":"..."},{"id":"ch1","title":"...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. No markdown, no code fences.`,
    };
  }

  if (normalizedFormat === "ebook") {
    return {
      useGpt4: true,
      maxTokens: 16000,
      prompt: `Create a premium EBOOK titled "${productName}" for the ${niche} niche.

Write a comprehensive ebook chapter of 700–1000 words. This is a premium digital product worth $47–97. This is premium content users will pay $37–97 for. Make it extremely valuable and comprehensive.

${ctx}
${SELLABLE_STRUCTURE}
${CHAPTER_TITLES_RULE}

CHAPTER STRUCTURE (every chapter must follow this):
1. Hook (2–3 sentences) – grab attention
2. Context (1 paragraph) – why this chapter matters
3. Detailed teaching (5–6 paragraphs) – core content with examples; include stories, research, expert quotes, and visual examples where relevant
4. Case study (1 detailed real-world scenario)
5. Key takeaways (bullet list or short summary)

Include: stories, research, expert quotes, and visual examples. Use <h2>, <h3> for subheadings. ${htmlRules}

Generate sections in this order:
- outcome-promise, fast-start, framework (as defined in SELLABLE CONTENT above)
- 1 introduction (id: "intro", 400–500 words)
- 6–10 chapters (ids: ch1, ch2, …). Each chapter body MUST be 700–1000 words of HTML. Use benefit-driven chapter titles.
- disclaimer (id: "disclaimer") at the end.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"intro","title":"...","body":"..."},{"id":"ch1","title":"...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
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

Generate sections in this order:
- outcome-promise, fast-start, framework (as defined in SELLABLE CONTENT above)
- 6–12 steps (ids: step1, step2, …). Each step body MUST be 600–800 words of HTML. Step titles benefit-driven.
- disclaimer (id: "disclaimer") at the end.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"step1","title":"Step 1: ...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
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

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"check1","title":"...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. 30–50 items per checklist. No markdown, HTML only.`,
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

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"p1","title":"...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. 50–75 prompt sections. No markdown, HTML only.`,
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

Generate sections in this order:
- outcome-promise, fast-start, framework (as in SELLABLE CONTENT)
- 8–12 modules (ids: mod1, mod2, …). Each module body 500–700 words of HTML. Module titles benefit-driven.
- disclaimer at the end.

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"mod1","title":"Module 1: ...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
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

Return ONLY a JSON object: {"sections":[{"id":"outcome-promise","title":"...","body":"..."},{"id":"fast-start","title":"Quick Wins: 3 Things You Can Do Today","body":"..."},{"id":"framework","title":"...","body":"..."},{"id":"t1","title":"...","body":"..."}, ..., {"id":"disclaimer","title":"...","body":"..."}]}. No markdown, HTML only.`,
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

Make each section 600–800 words with comprehensive Excel instruction. Return 4–8 sections as valid JSON: {"sections":[{"id":"s1","title":"Section title","body":"<h2>...</h2><p>...</p>"}]}. No markdown, HTML only in body.`,
    };
  }

  if (normalizedFormat === "notion") {
    return {
      useGpt4: false,
      maxTokens: 16000,
      prompt: `Outline a NOTION product for "${productName}" (${niche} niche). Describe pages and databases.

${ctx}

Return 4–8 sections. Each section = one page or database: "title" = page/database name, "body" = HTML description of properties, views, and content. Return ONLY JSON: {"sections":[{"id":"p1","title":"...","body":"..."}]}.`,
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

Return a JSON object with key "sections": array of {"id","title","body"}. Use clean HTML in body only. No markdown. Return ONLY the JSON.`,
  };
}

export async function generateProductContent(params: GenerateProductContentParams): Promise<GenerateContentSection[]> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const { format = "ebook" } = params;
  const { prompt, useGpt4, maxTokens } = buildPrompt(params);

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
  const parsed = JSON.parse(jsonStr) as { sections?: Array<{ id?: string; title?: string; body?: string }> };
  const sections: GenerateContentSection[] = (parsed.sections || []).map((s, i) => ({
    id: typeof s.id === "string" && s.id ? s.id : `section-${i + 1}`,
    title: typeof s.title === "string" && s.title ? s.title : `Section ${i + 1}`,
    body: typeof s.body === "string" ? s.body : "",
  }));

  if (sections.length === 0) throw new Error("AI returned no sections");
  return sections;
}
