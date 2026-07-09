# Format selection trace and fix

## 1) Where format is selected and how it reaches the API

**Step 6 (DiscoverFlow.tsx)**
- Format options: `PRODUCT_FORMATS` with `id`: `"ebook"` | `"workbook"` | `"spreadsheet"` | `"notion"` | `"course"` | `"checklist"` | `"journal"` | `"planner"` (lines 161–170).
- User clicks a card → `setProductFormat(f.id)` (line 2258).
- On Create (step 7): `handleCreateProduct` sends:
  ```js
  fetch("/api/products/create", {
    body: JSON.stringify({
      ...
      format: productFormat,  // line 1057
      ...
    }),
  });
  ```

**Create route (app/api/products/create/route.ts)**
- Reads `format = normalizeFormat(body.format, "ebook")` (line 33).
- Saves product with that `format` in DB (line 55).
- Calls process with the **same** `body`: `fetch(process, { body: JSON.stringify(body) })` (line 67).

**Process route (app/api/products/[id]/process/route.ts)**
- Reads `formatFromBody = body.format`, `formatFromDb = existing.format`, then `format = normalizeFormat(formatFromBody || formatFromDb, "ebook")` (lines 52–54).
- Passes `format` into `params` for `generateProductOutline(params)` and `generateSingleSectionBody(params, ...)` (lines 76–84, 104–105).

**Bug (normalizeFormat):** If the client or any caller sends `"course_outline"` or `"notion_template"` (with underscore), `VALID_FORMATS.includes("course_outline")` is false, so `normalizeFormat` returns fallback `"ebook"`. So format can be lost when underscore variants are used.

---

## 2) AI prompts that generate product content

**Outline (generateProductOutline)** – lib/generate-product-content.ts ~395–414:
```
Product: "[name]". Format: ${format}. Niche: ${niche}.
...
CRITICAL: This product is a ${format.toUpperCase()}. Use ONLY the structure for this format — do not output workbook-style content for non-workbook formats.
${formatStructureNote}
Generate exactly these sections in order (use these exact ids): ${sectionCountHint}
```

**Section body (generateSingleSectionBody)** – lib/generate-product-content.ts ~568–579:
```
Product: "[name]". Format: ${format}. Niche: ${niche}.
...
Write ONLY the content for this section ...
Requirements: ${baseRequirements}
```

**Problem:** The section-body request uses a single **system** message for all formats (SYSTEM_PREMIUM): *"Write content that fills full pages. Include extensive details, real-world examples, and actionable advice."* That pushes the model toward long, workbook-like content. The format appears only in the user message as `Format: ${format}` with no explicit “if format is X then do Y; never output workbook content unless format is workbook.” So the model can ignore format and default to workbook-style.

---

## 3) Fix (applied below)

1. **normalizeFormat (create + process):** Accept `course_outline` → `"course"`, `notion_template` → `"notion"` so format is never lost for those values.
2. **Outline prompt:** Add an explicit line: “The selected format is **[format]**. You MUST use only the section ids and structure for that format. Do NOT use workbook/chapter structure unless format is workbook.”
3. **Section body:** Add a format block at the top of the user prompt: “SELECTED FORMAT: [format]. You MUST write content for this format only. [One-line rule per format: ebook=teaching/chapters, workbook=prompts+writing spaces, planner=layouts only, etc.] Do NOT write workbook-style content unless format is workbook.” Optionally use a format-specific system message (or a second user message) so the model is not steered by the generic “fill full pages” system text for non-workbook formats.
