/**
 * markdown-to-tiptap.ts
 *
 * Converts a markdown string into a TipTap / ProseMirror JSON document string.
 * Pure TypeScript — no external markdown libraries required.
 *
 * Supported:
 *   Block:  # headings (H1–H6), paragraphs, bullet lists (- * +), ordered lists,
 *           blockquote (>), fenced code blocks (```), horizontal rule (---),
 *           tables (| col | col |)
 *   Inline: **bold**, *italic*, ***bold+italic***, `code`, ~~strikethrough~~,
 *           [link](url), _italic_
 */

// ─── Node types ───────────────────────────────────────────────────────────────

type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "code" }
  | { type: "strike" }
  | { type: "link"; attrs: { href: string; target: string } };

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Mark[];
}

// ─── Inline parser ────────────────────────────────────────────────────────────

/**
 * Parse an inline markdown string into an array of TipTap text nodes.
 * Handles: ***bold+italic***, **bold**, *italic*, _italic_, `code`, ~~strike~~, [text](url)
 */
export function parseInline(text: string): TipTapNode[] {
  if (!text) return [];

  const nodes: TipTapNode[] = [];
  // Token regex — order matters (longer patterns before shorter)
  const TOKEN =
    /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|~~(.+?)~~|\*([^*\n]+?)\*|`([^`\n]+)`|\[([^\]]+)\]\(([^)]+)\)|_([^_\n]+?)_/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    const [, boldItalic, bold, strike, italic, code, linkText, linkUrl, underscoreItalic] = match;

    if (boldItalic !== undefined) {
      nodes.push({ type: "text", text: boldItalic, marks: [{ type: "bold" }, { type: "italic" }] });
    } else if (bold !== undefined) {
      nodes.push({ type: "text", text: bold, marks: [{ type: "bold" }] });
    } else if (strike !== undefined) {
      nodes.push({ type: "text", text: strike, marks: [{ type: "strike" }] });
    } else if (italic !== undefined) {
      nodes.push({ type: "text", text: italic, marks: [{ type: "italic" }] });
    } else if (code !== undefined) {
      nodes.push({ type: "text", text: code, marks: [{ type: "code" }] });
    } else if (linkText !== undefined && linkUrl !== undefined) {
      nodes.push({ type: "text", text: linkText, marks: [{ type: "link", attrs: { href: linkUrl, target: "_blank" } }] });
    } else if (underscoreItalic !== undefined) {
      nodes.push({ type: "text", text: underscoreItalic, marks: [{ type: "italic" }] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

// ─── Block helpers ────────────────────────────────────────────────────────────

function para(text: string): TipTapNode {
  const inline = parseInline(text);
  return { type: "paragraph", content: inline.length > 0 ? inline : [] };
}

function h(level: number, text: string): TipTapNode {
  return { type: "heading", attrs: { level }, content: parseInline(text) };
}

// ─── Table parser ─────────────────────────────────────────────────────────────

function parseTable(lines: string[]): TipTapNode {
  const rows: TipTapNode[] = [];
  let headerDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Separator row — only dashes, pipes, colons
    if (/^[\|\s:\-]+$/.test(trimmed) && trimmed.includes("-")) {
      headerDone = true;
      continue;
    }

    const cells = trimmed.replace(/^\||\|$/g, "").split("|");

    rows.push({
      type: "tableRow",
      content: cells.map((cell) => ({
        type: headerDone ? "tableCell" : "tableHeader",
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [{ type: "paragraph", content: parseInline(cell.trim()) }],
      })),
    });
  }

  return { type: "table", content: rows };
}

// ─── Block parser ─────────────────────────────────────────────────────────────

/**
 * Parse markdown into an array of TipTap block nodes.
 */
export function parseBlocks(markdown: string): TipTapNode[] {
  const lines = markdown.split("\n");
  const nodes: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip
    if (!line.trim()) { i++; continue; }

    // ── Headings ─────────────────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push(h(headingMatch[1].length, headingMatch[2].trim()));
      i++;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      nodes.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // ── Fenced code block ─────────────────────────────────────────────────────
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      nodes.push({
        type: "codeBlock",
        attrs: { language: null },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────────
    if (line.trimStart().startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const inner = parseBlocks(quoteLines.join("\n"));
      nodes.push({
        type: "blockquote",
        content: inner.length > 0 ? inner : [{ type: "paragraph", content: [] }],
      });
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────────────────
    if (line.includes("|")) {
      const nextLine = lines[i + 1] ?? "";
      if (/^[\|\s:\-]+$/.test(nextLine.trim()) && nextLine.includes("-")) {
        const tableLines: string[] = [];
        while (i < lines.length && (lines[i].includes("|") || /^[\|\s:\-]+$/.test(lines[i].trim()))) {
          tableLines.push(lines[i]);
          i++;
        }
        nodes.push(parseTable(tableLines));
        continue;
      }
    }

    // ── Bullet list ───────────────────────────────────────────────────────────
    if (/^(\s*)[-*+] /.test(line)) {
      const baseIndent = (line.match(/^(\s*)/)?.[1] ?? "").length;
      const items: TipTapNode[] = [];

      while (i < lines.length) {
        const curr = lines[i];
        const m = curr.match(/^(\s*)[-*+] (.*)$/);
        if (!m) break;
        const indent = m[1].length;
        if (indent < baseIndent) break;
        if (indent > baseIndent) { i++; continue; } // nested — skip for now
        items.push({ type: "listItem", content: [para(m[2])] });
        i++;
      }

      if (items.length > 0) nodes.push({ type: "bulletList", content: items });
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, "");
        items.push({ type: "listItem", content: [para(text)] });
        i++;
      }
      if (items.length > 0) nodes.push({ type: "orderedList", attrs: { start: 1 }, content: items });
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    const paraLines: string[] = [];
    while (i < lines.length) {
      const curr = lines[i];
      if (!curr.trim()) break;
      if (/^#{1,6} /.test(curr)) break;
      if (/^[-*_]{3,}\s*$/.test(curr.trim())) break;
      if (curr.trimStart().startsWith("```")) break;
      if (curr.trimStart().startsWith("> ")) break;
      if (/^(\s*)[-*+] /.test(curr)) break;
      if (/^\d+\. /.test(curr)) break;
      if (curr.includes("|") && /^[\|\s:\-]+$/.test((lines[i + 1] ?? "").trim()) && (lines[i + 1] ?? "").includes("-")) break;
      paraLines.push(curr);
      i++;
    }

    if (paraLines.length > 0) {
      // Each line in a paragraph group becomes its own paragraph
      // (preserves the visual spacing the report markdown produces)
      for (const pLine of paraLines) {
        const trimmed = pLine.trim();
        if (trimmed) nodes.push(para(trimmed));
      }
    }
  }

  return nodes;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert a markdown string into a JSON-stringified TipTap ProseMirror document.
 * Pass the result directly as the `content` prop of NoteEditor.
 */
export function markdownToTipTap(markdown: string): string {
  if (!markdown?.trim()) {
    return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  }
  const content = parseBlocks(markdown.trim());
  if (content.length === 0) content.push({ type: "paragraph", content: [] });
  return JSON.stringify({ type: "doc", content });
}
