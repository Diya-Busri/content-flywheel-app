/**
 * Builds a full HTML document for server-side PDF generation (Puppeteer).
 * Matches the editor preview: one page per section, backgrounds, overlays, text, placed elements.
 */

import { cleanMarkdownToHtml } from "@/lib/clean-markdown";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;

type TemplateId = "modern" | "classic" | "minimal" | "bold" | "elegant" | "creative";

const TEMPLATE_PRESETS: Record<
  TemplateId,
  { fontFamily: string; titleColor: string; headingColor: string; bodyColor: string }
> = {
  modern: { fontFamily: "Inter, system-ui, sans-serif", titleColor: "#FF6B35", headingColor: "#1a1a1a", bodyColor: "#4a4a4a" },
  classic: { fontFamily: "Georgia, 'Times New Roman', serif", titleColor: "#2c3e50", headingColor: "#2c3e50", bodyColor: "#34495e" },
  minimal: { fontFamily: "Inter, system-ui, sans-serif", titleColor: "#111827", headingColor: "#1f2937", bodyColor: "#6b7280" },
  bold: { fontFamily: "'DM Sans', Inter, sans-serif", titleColor: "#7C3AED", headingColor: "#1a1a1a", bodyColor: "#374151" },
  elegant: { fontFamily: "'Playfair Display', Georgia, serif", titleColor: "#6B4E71", headingColor: "#2d2d2d", bodyColor: "#5a5a5a" },
  creative: { fontFamily: "'Nunito', Inter, sans-serif", titleColor: "#EC4899", headingColor: "#1f2937", bodyColor: "#4b5563" },
};

const DEFAULT_IMAGE = { opacity: 1, blur: 0, brightness: 100, contrast: 100, saturation: 100, fit: "cover" as const, position: "center center" };
const DEFAULT_OVERLAY = { color: "rgba(255, 255, 255, 0.9)", opacity: 0.9 };

export interface PdfSection {
  id?: string;
  title: string;
  body?: string;
  contentHtml?: string;
  imageUrl?: string | null;
}

export interface PdfPageBackground {
  backgroundImage?: string | null;
  backgroundSettings?: { opacity?: number; blur?: number; brightness?: number; contrast?: number; saturation?: number; fit?: string; position?: string };
  overlaySettings?: { color?: string; opacity?: number };
}

const DEFAULT_TEXT_BOX = {
  fontSize: 16,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#333333",
  textAlign: "left" as const,
};

export interface PdfPlacedElement {
  id: string;
  type: "icon" | "image" | "text";
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
  imageSettings?: { opacity?: number };
  textSettings?: { fontSize?: number; fontFamily?: string; color?: string; textAlign?: "left" | "center" | "right" };
}

export interface PdfProductPayload {
  title: string;
  sections: PdfSection[];
  pageBackgrounds?: PdfPageBackground[];
  designSettings?: {
    template?: string;
    layout?: { margins?: number; paragraphSpacing?: number; sectionSpacing?: number; lineHeight?: number; alignment?: string; maxWidth?: string };
    colors?: { graphics?: string };
    textStyles?: Record<string, { title?: { color?: string; fontFamily?: string }; body?: { color?: string; fontFamily?: string }; blocks?: Array<Record<string, string>> }>;
  };
  placedElementsByPage?: PdfPlacedElement[][];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionBodyHtml(section: PdfSection): string {
  const raw = section.contentHtml ?? (section.body != null ? cleanMarkdownToHtml(section.body) : "");
  return raw || "<span style='color:#999'>(Empty)</span>";
}

function blockStylesToCss(s: Record<string, string>): string {
  const parts: string[] = [];
  if (s.color) parts.push(`color:${s.color}`);
  if (s.fontSize) parts.push(`font-size:${s.fontSize}`);
  if (s.fontFamily) parts.push(`font-family:${s.fontFamily}`);
  if (s.fontWeight) parts.push(`font-weight:${s.fontWeight}`);
  if (s.textAlign) parts.push(`text-align:${s.textAlign}`);
  if (s.lineHeight) parts.push(`line-height:${s.lineHeight}`);
  if (s.textDecoration) parts.push(`text-decoration:${s.textDecoration}`);
  if (s.textTransform) parts.push(`text-transform:${s.textTransform}`);
  if (s.backgroundColor && s.backgroundColor !== "transparent") parts.push(`background-color:${s.backgroundColor}`);
  return parts.join(";");
}

/** Injects per-block inline styles into section body HTML so headings/subheadings/paragraphs keep editor styles in PDF. */
function injectBlockStyles(html: string, blocks: Array<Record<string, string>> | undefined): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return html;
  let index = 0;
  return html.replace(/<(h2|h3|h4|p)(\s[^>]*)?>/gi, (match, tag: string, rest: string) => {
    const s = blocks[index];
    index += 1;
    if (!s || typeof s !== "object") return match;
    const styleStr = blockStylesToCss(s);
    if (!styleStr) return match;
    const safe = styleStr.replace(/"/g, "&quot;");
    return `<${tag}${rest || ""} style="${safe}">`;
  });
}

function iconToImgHtml(content: string, color: string): string {
  if (content.includes(":")) {
    const [prefix, name] = content.split(":");
    const src = `https://api.iconify.design/${prefix}/${name}.svg?color=${encodeURIComponent(color.replace("#", ""))}`;
    return `<img src="${escapeHtml(src)}" alt="" style="width:100%;height:100%;object-fit:contain" loading="lazy" />`;
  }
  const svgByNames: Record<string, string> = {
    Star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>',
    Heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>',
    Zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>',
    Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    MessageCircle: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="currentColor"/>',
    Bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/>',
    Check: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    BookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zm20 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="currentColor"/>',
  };
  const path = svgByNames[content];
  if (path) {
    return `<span style="display:inline-block;width:100%;height:100%;color:${escapeHtml(color)}"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor">${path}</svg></span>`;
  }
  return `<span style="color:#999;font-size:12px">?</span>`;
}

/** Build HTML for a single page (one section). Used for page-by-page PDF rendering. */
export function buildSinglePageHtml(payload: PdfProductPayload, pageIdx: number): string {
  const { title, sections, pageBackgrounds = [], designSettings = {}, placedElementsByPage = [] } = payload;
  const templateId = (designSettings.template as TemplateId) || "modern";
  const preset = TEMPLATE_PRESETS[templateId] ?? TEMPLATE_PRESETS.modern;
  const layout = designSettings.layout ?? {};
  const margins = layout.margins ?? 2;
  const paragraphSpacing = layout.paragraphSpacing ?? 1;
  const sectionSpacing = layout.sectionSpacing ?? 2;
  const lineHeight = layout.lineHeight ?? 1.6;
  const alignment = layout.alignment ?? "left";
  const maxWidth = layout.maxWidth === "narrow" ? 600 : layout.maxWidth === "wide" ? 1000 : 800;
  const graphicsColor = designSettings.colors?.graphics ?? "#333333";

  const pages = sections.length ? sections : [{ title: title, body: "" }];
  const section = pages[pageIdx] ?? pages[0];

  const pageBg = pageBackgrounds[pageIdx];
  const bgUrl = pageBg?.backgroundImage ?? null;
  const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE, ...pageBg.backgroundSettings } : DEFAULT_IMAGE;
  const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;
  const overlayOpacity = typeof overlay.opacity === "number" ? (overlay.opacity > 1 ? overlay.opacity / 100 : overlay.opacity) : 0.9;
  const titleStyles = designSettings.textStyles?.[section.id ?? ""]?.title;
  const bodyStyles = designSettings.textStyles?.[section.id ?? ""]?.body;
  const productTitleColor = preset.titleColor;
  const headingColor = titleStyles?.color ?? bodyStyles?.color ?? preset.headingColor;
  const bodyColor = bodyStyles?.color ?? preset.bodyColor;

  let bgBlock = "";
  if (bgUrl) {
    const fit = bgSettings.fit ?? "cover";
    const pos = bgSettings.position ?? "center center";
    const opacity = bgSettings.opacity ?? 1;
    const filter =
      (bgSettings.blur ?? 0) > 0
        ? `blur(${bgSettings.blur}px) brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`
        : `brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`;
    bgBlock = `
        <div class="pdf-bg" style="position:absolute;inset:0;z-index:0;overflow:hidden;">
          <img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:${fit};object-position:${pos};opacity:${opacity};filter:${escapeHtml(filter)};" />
        </div>
        <div class="pdf-overlay" style="position:absolute;inset:0;z-index:1;pointer-events:none;background-color:${escapeHtml(overlay.color)};opacity:${overlayOpacity};"></div>`;
  }

  const placed = (placedElementsByPage[pageIdx] ?? [])
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((el) => {
      const color = graphicsColor;
      let inner: string;
      if (el.type === "text") {
        const ts = { ...DEFAULT_TEXT_BOX, ...el.textSettings };
        inner = `<div style="width:100%;height:100%;overflow:hidden;padding:4px;display:flex;align-items:center;word-break:break-word;font-size:${ts.fontSize}px;font-family:${escapeHtml(ts.fontFamily)};color:${escapeHtml(ts.color)};text-align:${ts.textAlign};">${escapeHtml(el.content || "")}</div>`;
      } else if (el.type === "image") {
        inner = `<img src="${escapeHtml(el.content)}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:${el.imageSettings?.opacity ?? 1};" />`;
      } else {
        inner = iconToImgHtml(el.content, color);
      }
      return `<div class="pdf-placed" style="position:absolute;left:${el.position.x}px;top:${el.position.y}px;width:${el.size.width}px;height:${el.size.height}px;z-index:${Math.max(1, el.zIndex ?? 0)};display:flex;align-items:center;justify-content:center;">${inner}</div>`;
    })
    .join("");

  const bodyHtmlRaw = sectionBodyHtml(section);
  const sectionBlockStyles = designSettings.textStyles?.[section.id ?? ""]?.blocks;
  const bodyHtml = injectBlockStyles(bodyHtmlRaw, sectionBlockStyles);
  const sectionImage = section.imageUrl?.trim() ? `<div class="pdf-section-image" style="margin:1rem 0 1.5rem;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:100%;height:auto;max-height:320px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>` : "";
  const pageDiv = `
      <div class="pdf-page" style="position:relative;background:#fff;width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;overflow:hidden;box-sizing:border-box;">
        ${bgBlock}
        <div class="pdf-content" style="position:relative;z-index:10;font-family:${escapeHtml(preset.fontFamily)};max-width:${maxWidth}px;margin:0 auto;padding:${margins}rem;height:100%;box-sizing:border-box;overflow:auto;${bgUrl ? "background:transparent;" : ""}">
          <h2 class="pdf-title" style="font-size:1.5rem;font-weight:700;border-bottom:1px solid currentColor;padding-bottom:0.5rem;margin:0 0 1rem;color:${escapeHtml(productTitleColor)};">${escapeHtml(title)}</h2>
          <section>
            <h3 class="pdf-heading" style="font-size:1.125rem;font-weight:600;margin:0 0 0.5rem;color:${escapeHtml(headingColor)};">${escapeHtml(section.title)}</h3>
            ${sectionImage}
            <div class="pdf-body prose" style="margin-top:0.5rem;color:${escapeHtml(bodyColor)};font-size:${maxWidth >= 900 ? "1rem" : "0.875rem"};line-height:${lineHeight};text-align:${alignment};">
              ${bodyHtml}
            </div>
          </section>
        </div>
        <div class="pdf-placed-layer" style="position:absolute;inset:0;pointer-events:none;z-index:20;">${placed}</div>
      </div>`;

  const css = `
    .pdf-page { position: relative; overflow: hidden; }
    .pdf-page * { box-sizing: border-box; }
    .pdf-bg img { display: block; }
    .pdf-content p { margin-bottom: ${paragraphSpacing}rem; }
    .pdf-content h2, .pdf-content h3 { margin-top: ${sectionSpacing * 0.75}rem; margin-bottom: ${paragraphSpacing}rem; }
    .pdf-content ul, .pdf-content ol { margin-bottom: ${paragraphSpacing}rem; padding-left: 1.5rem; }
    .pdf-content li { margin-bottom: 0.5rem; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${CANVAS_WIDTH}, initial-scale=1" />
  <title>${escapeHtml(title)} - ${escapeHtml(section.title)}</title>
  <style>${css}</style>
  <link rel="preconnect" href="https://api.iconify.design" />
</head>
<body style="margin:0;padding:0;background:#fff;">
  ${pageDiv}
</body>
</html>`;
}

/** Returns HTML fragment (style + single page div) for client-side PDF export. */
export function buildSinglePageFragment(payload: PdfProductPayload, pageIdx: number): string {
  const full = buildSinglePageHtml(payload, pageIdx);
  const styleMatch = full.match(/<style>([\s\S]*?)<\/style>/i);
  const bodyMatch = full.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const style = styleMatch ? styleMatch[1] : "";
  const body = bodyMatch ? bodyMatch[1].trim() : "";
  return `<style>${style}</style>${body}`;
}

export function buildProductPdfHtml(payload: PdfProductPayload): string {
  const { title, sections, pageBackgrounds = [], designSettings = {}, placedElementsByPage = [] } = payload;
  const templateId = (designSettings.template as TemplateId) || "modern";
  const preset = TEMPLATE_PRESETS[templateId] ?? TEMPLATE_PRESETS.modern;
  const layout = designSettings.layout ?? {};
  const margins = layout.margins ?? 2;
  const paragraphSpacing = layout.paragraphSpacing ?? 1;
  const sectionSpacing = layout.sectionSpacing ?? 2;
  const lineHeight = layout.lineHeight ?? 1.6;
  const alignment = layout.alignment ?? "left";
  const maxWidth = layout.maxWidth === "narrow" ? 600 : layout.maxWidth === "wide" ? 1000 : 800;
  const graphicsColor = designSettings.colors?.graphics ?? "#333333";

  const pages = sections.length ? sections : [{ title: title, body: "" }];

  const pageDivs = pages.map((section, pageIdx) => {
    const pageBg = pageBackgrounds[pageIdx];
    const bgUrl = pageBg?.backgroundImage ?? null;
    const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE, ...pageBg.backgroundSettings } : DEFAULT_IMAGE;
    const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;
    const overlayOpacity = typeof overlay.opacity === "number" ? (overlay.opacity > 1 ? overlay.opacity / 100 : overlay.opacity) : 0.9;
    const titleStyles = designSettings.textStyles?.[section.id ?? ""]?.title;
    const bodyStyles = designSettings.textStyles?.[section.id ?? ""]?.body;
    const productTitleColor = preset.titleColor;
    const headingColor = titleStyles?.color ?? bodyStyles?.color ?? preset.headingColor;
    const bodyColor = bodyStyles?.color ?? preset.bodyColor;

    let bgBlock = "";
    if (bgUrl) {
      const fit = bgSettings.fit ?? "cover";
      const pos = bgSettings.position ?? "center center";
      const opacity = bgSettings.opacity ?? 1;
      const filter =
        (bgSettings.blur ?? 0) > 0
          ? `blur(${bgSettings.blur}px) brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`
          : `brightness(${bgSettings.brightness ?? 100}%) contrast(${bgSettings.contrast ?? 100}%) saturate(${bgSettings.saturation ?? 100}%)`;
      bgBlock = `
        <div class="pdf-bg" style="position:absolute;inset:0;z-index:0;overflow:hidden;">
          <img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:${fit};object-position:${pos};opacity:${opacity};filter:${escapeHtml(filter)};" />
        </div>
        <div class="pdf-overlay" style="position:absolute;inset:0;z-index:1;pointer-events:none;background-color:${escapeHtml(overlay.color)};opacity:${overlayOpacity};"></div>`;
    }

    const placed = (placedElementsByPage[pageIdx] ?? [])
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .map((el) => {
        const color = graphicsColor;
        let inner: string;
        if (el.type === "text") {
          const ts = { ...DEFAULT_TEXT_BOX, ...el.textSettings };
          inner = `<div style="width:100%;height:100%;overflow:hidden;padding:4px;display:flex;align-items:center;word-break:break-word;font-size:${ts.fontSize}px;font-family:${escapeHtml(ts.fontFamily)};color:${escapeHtml(ts.color)};text-align:${ts.textAlign};">${escapeHtml(el.content || "")}</div>`;
        } else if (el.type === "image") {
          inner = `<img src="${escapeHtml(el.content)}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:${el.imageSettings?.opacity ?? 1};" />`;
        } else {
          inner = iconToImgHtml(el.content, color);
        }
        return `<div class="pdf-placed" style="position:absolute;left:${el.position.x}px;top:${el.position.y}px;width:${el.size.width}px;height:${el.size.height}px;z-index:${Math.max(1, el.zIndex ?? 0)};display:flex;align-items:center;justify-content:center;">${inner}</div>`;
      })
      .join("");

    const bodyHtmlRaw = sectionBodyHtml(section);
    const sectionBlockStyles = designSettings.textStyles?.[section.id ?? ""]?.blocks;
    const bodyHtml = injectBlockStyles(bodyHtmlRaw, sectionBlockStyles);
    const sectionImage = section.imageUrl?.trim() ? `<div class="pdf-section-image" style="margin:1rem 0 1.5rem;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:100%;height:auto;max-height:320px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>` : "";
    return `
      <div class="pdf-page" style="position:relative;background:#fff;">
        ${bgBlock}
        <div class="pdf-content" style="position:relative;z-index:10;font-family:${escapeHtml(preset.fontFamily)};max-width:${maxWidth}px;margin:0 auto;padding:${margins}rem;height:100%;box-sizing:border-box;overflow:auto;${bgUrl ? "background:transparent;" : ""}">
          <h2 class="pdf-title" style="font-size:1.5rem;font-weight:700;border-bottom:1px solid currentColor;padding-bottom:0.5rem;margin:0 0 1rem;color:${escapeHtml(productTitleColor)};">${escapeHtml(title)}</h2>
          <section>
            <h3 class="pdf-heading" style="font-size:1.125rem;font-weight:600;margin:0 0 0.5rem;color:${escapeHtml(headingColor)};">${escapeHtml(section.title)}</h3>
            ${sectionImage}
            <div class="pdf-body prose" style="margin-top:0.5rem;color:${escapeHtml(bodyColor)};font-size:${maxWidth >= 900 ? "1rem" : "0.875rem"};line-height:${lineHeight};text-align:${alignment};">
              ${bodyHtml}
            </div>
          </section>
        </div>
        <div class="pdf-placed-layer" style="position:absolute;inset:0;pointer-events:none;z-index:20;">${placed}</div>
      </div>`;
  });

  const css = `
    @page { size: ${CANVAS_WIDTH}px ${CANVAS_HEIGHT}px; margin: 0; }
    .pdf-page {
      box-sizing: border-box;
      width: ${CANVAS_WIDTH}px;
      height: ${CANVAS_HEIGHT}px;
      overflow: hidden;
      page-break-after: always;
      page-break-inside: avoid;
    }
    .pdf-page:last-child { page-break-after: auto; }
    .pdf-page * { box-sizing: border-box; }
    .pdf-bg img { display: block; }
    .pdf-content p { margin-bottom: ${paragraphSpacing}rem; }
    .pdf-content h2, .pdf-content h3 { margin-top: ${sectionSpacing * 0.75}rem; margin-bottom: ${paragraphSpacing}rem; }
    .pdf-content ul, .pdf-content ol { margin-bottom: ${paragraphSpacing}rem; padding-left: 1.5rem; }
    .pdf-content li { margin-bottom: 0.5rem; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${CANVAS_WIDTH}, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
  <link rel="preconnect" href="https://api.iconify.design" />
</head>
<body style="margin:0;padding:0;background:#fff;">
  <div class="pdf-pages" style="display:flex;flex-direction:column;align-items:center;gap:0;">
    ${pageDivs.join("\n")}
  </div>
</body>
</html>`;
}
