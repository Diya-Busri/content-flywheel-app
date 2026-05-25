/**
 * Converts common markdown in text to HTML so content displays without visible
 * asterisks/hashes (e.g. "**Bold**" -> "<strong>Bold</strong>").
 * Use when rendering section content that may contain markdown.
 */
export function cleanMarkdownToHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  // Strip literal \n escape sequences the AI occasionally outputs as text
  text = text.replace(/\\n/g, " ");
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>") // ***bold italic***
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") // **bold**
    .replace(/\*(.+?)\*/g, "<em>$1</em>") // *italic* (non-greedy to avoid crossing)
    .replace(/##\s+(.+)(?=\n|$)/gm, "<h3>$1</h3>") // ## Heading
    .replace(/#\s+(.+)(?=\n|$)/gm, "<h2>$1</h2>"); // # Heading
}
