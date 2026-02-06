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

export async function generateProductContent(params: GenerateProductContentParams): Promise<GenerateContentSection[]> {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const {
    productName,
    productDescription = "",
    productIncluded = "",
    productWhy = "",
    niche = "",
    format = "ebook",
    hookTexts = [],
    ctaTexts = [],
  } = params;

  const isWorkbook = format === "workbook";

  let prompt: string;
  if (isWorkbook) {
    prompt = `You are an expert digital product creator. Create a COMPREHENSIVE INTERACTIVE WORKBOOK titled "${productName}" for the ${niche} niche.

This is a premium workbook ($37-67 price point), so it must be substantial and actionable.

STRUCTURE REQUIRED:

1. Introduction section (id: "intro")
   - Welcome message, how to use this workbook, what they'll achieve, materials needed. Use HTML: <p>, <h2>, <h3>, <ul><li>.

2. 8-12 Main Chapter sections (ids: ch1, ch2, ... ch10 or more). EACH chapter must include:
   - Chapter overview (2-3 paragraphs)
   - Learning objectives (3-5 bullet points in <ul>)
   - Main lesson content (detailed explanation)
   - Real-world examples (2-3 examples in a div with class="example-box")
   - Interactive exercises (3-5 exercises with [FILL IN] placeholders, in div class="exercise-box")
   - Reflection questions (3-4 deep questions, use <ol>)
   - Action items checklist (5-7 tasks with ☐ in <ul class="checklist">)
   - Notes section (div class="notes-space" with blank lines for personal notes)

3. Use these HTML patterns:
   - <div class="chapter-intro"> for chapter intro blocks
   - <div class="example-box"> for case studies/examples
   - <div class="exercise-box"> for "Your Turn:" exercises with [FILL IN]
   - <ul class="checklist"> for action items with ☐
   - <div class="notes-space"> for note-taking space
   - <table> with <th>, <td> for worksheets (use [FILL IN] in cells where user fills in)

4. Include in content: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>. No markdown (** or ##). Use "Your Turn:", "Reflection:", "✅ Action Items", "📊 Worksheet" style headings where appropriate.

PRODUCT CONTEXT:
- What's included: ${productIncluded || "N/A"}
- Why it sells: ${productWhy || "N/A"}
${productDescription ? `- Description: ${productDescription}` : ""}
${hookTexts.length ? `Hooks to weave in: ${hookTexts.join(" | ")}` : ""}
${ctaTexts.length ? `CTAs: ${ctaTexts.join(" | ")}` : ""}

Return ONLY a valid JSON object with a single key "sections", an array of objects. Each object: "id" (string), "title" (string), "body" (string, full HTML for that section). Generate 10 comprehensive chapter sections plus intro. Each chapter body should be 400-800 words of HTML with the structure above. No markdown, no code fences.`;
  } else {
    const formatGuidance: Record<string, string> = {
      ebook: "Write as a professional ebook/guide: clear chapters, engaging intro, actionable advice, optional bullet lists.",
      spreadsheet: "Describe what each sheet/section should contain (you're outlining a spreadsheet: categories, columns, formulas). Return 4-8 'sections' that are sheet descriptions.",
      notion: "Describe Notion pages and databases: what each page contains, what properties/databases to include. Return 4-8 sections that are page/database descriptions.",
      course: "Write as a course outline: module titles, lesson titles, and 2-4 bullet points per lesson describing what will be taught.",
      checklist: "Write as printable checklists: each section is one checklist with a title and 5-12 actionable items with checkboxes (describe the items).",
    };
    const formatGuide = formatGuidance[format] || formatGuidance.ebook;

    prompt = `You are an expert digital product creator. Generate the full CONTENT for a product (sections with title and body text) based on the following. Return ONLY valid JSON.

IMPORTANT: Return body content as clean HTML, NOT markdown.
- Use <strong> for bold, not **text**
- Use <em> for italic, not *text*
- Use <h2>, <h3> for subheadings, not ## or ###
- Use <ul><li> for lists, not - or *
- Use <p> tags for paragraphs
- No markdown asterisks or hashes in the output—only HTML tags.

PRODUCT:
- Name: "${productName}"
- What's included: ${productIncluded || "N/A"}
- Why it sells / audience: ${productWhy || "N/A"}
${productDescription ? `- Full description: ${productDescription}` : ""}

NICHE / AUDIENCE: ${niche || "General audience"}

FORMAT: ${format}
${formatGuide}

${hookTexts.length ? `MARKETING HOOKS (use tone/angle in content): ${hookTexts.join(" | ")}` : ""}
${ctaTexts.length ? `CTAs (align content toward these actions): ${ctaTexts.join(" | ")}` : ""}

Return a JSON object with a single key "sections" which is an array of objects. Each object must have:
- "id": short lowercase id (e.g. "intro", "ch1", "getting-started")
- "title": section or chapter title (clear, engaging)
- "body": full body as clean HTML. Use <p>, <strong>, <em>, <h2>, <h3>, <ul><li>. Be specific to the product and niche. Do NOT use ** or * or ## for formatting.

Example structure:
{"sections":[{"id":"intro","title":"Introduction","body":"<p>Your opening text here with <strong>key terms</strong> in HTML.</p>"},{"id":"ch1","title":"Chapter 1","body":"<p>Content with <strong>bold labels</strong> and <em>emphasis</em> using tags only.</p>"}]}

Return ONLY the JSON object, no markdown or explanation.`;
  }

  const completion = await openai.chat.completions.create({
    model: isWorkbook ? "gpt-4o" : "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: isWorkbook
          ? "You are an expert workbook and course creator. Return only valid JSON with a 'sections' array. No markdown, no code fences."
          : "You are an expert digital product creator. Return only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: isWorkbook ? 8000 : 4000,
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
