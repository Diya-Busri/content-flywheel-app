/**
 * Sanitize HTML for safe rendering (XSS protection).
 * Use before passing user or external content to dangerouslySetInnerHTML.
 */

const ALLOWED_TAGS = [
  "b", "strong", "i", "em", "u", "a", "p", "br", "ul", "ol", "li",
  "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
];

/** Server-side / no-DOM: strip dangerous content, allow safe tags only. */
function stripHtmlServer(html: string): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s*on\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, name) => (ALLOWED_TAGS.includes(name.toLowerCase()) ? match : ""));
}

/**
 * Sanitize HTML. Safe to call from client (uses DOMPurify when available) or server (uses strip).
 * For client components that render user content, call this before dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== "string") return "";
  if (typeof window !== "undefined") {
    try {
      const DOMPurify = require("dompurify");
      if (typeof DOMPurify.sanitize === "function") {
        return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOW_DATA_ATTR: false });
      }
    } catch {
      // DOMPurify not available (e.g. SSR)
    }
  }
  return stripHtmlServer(html);
}
