/**
 * Strip Etsy-style pipe-separated tags and hyphen-segment from a product title.
 * Use at the point the AI prompt is built — before sending to OpenAI. The AI should never see the full pipe-separated title.
 *
 * @example
 * cleanProductTitle("Personal Development Journals - Journal | Digital Download | Unlock Your Potential | Printable PDF")
 * // => "Personal Development Journals"
 */
export function cleanProductTitle(title: string | null | undefined): string {
  if (title == null) return "";
  // Only split on " - " (Etsy-style with spaces) — bare hyphens in names like "30-Day" must be preserved
  return String(title).split("|")[0].split(" - ")[0].trim();
}

/**
 * Replace the raw product title (e.g. with pipe tags) with the cleaned title inside script text.
 * Use when displaying or sending hook/body/CTA to voiceover so the full script shows only the cleaned title.
 */
export function replaceProductTitleInText(text: string | null | undefined, rawTitle: string | null | undefined): string {
  if (text == null) return "";
  const s = String(text);
  if (rawTitle == null || rawTitle === "") return s;
  const cleaned = cleanProductTitle(rawTitle);
  if (cleaned === "" || cleaned === String(rawTitle).trim()) return s;
  return s.split(rawTitle).join(cleaned);
}
