import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import { createPdfPreviewToken } from "@/lib/pdf-preview-token";

export const runtime = "nodejs";
export const maxDuration = 60;

// Match editor canvas exactly (lib/product-print-constants: 800x1100)
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;

const DEFAULT_IMAGE = {
  opacity: 1,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  fit: "cover",
  position: "center center",
};
const DEFAULT_OVERLAY = { color: "rgba(255, 255, 255, 0.9)", opacity: 0.9 };

const LUCIDE_TO_ICONIFY = {
  Star: "lucide:star",
  Heart: "lucide:heart",
  Zap: "lucide:zap",
  Target: "lucide:target",
  MessageCircle: "lucide:message-circle",
  Bookmark: "lucide:bookmark",
  Check: "lucide:check",
  BookOpen: "lucide:book-open",
};

function escapeHtml(s) {
  if (typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanMarkdownToHtml(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/##\s+(.+)(?=\n|$)/gm, "<h3>$1</h3>")
    .replace(/#\s+(.+)(?=\n|$)/gm, "<h2>$1</h2>");
}

/** Build inline CSS string from a block style object (editor textStyles.blocks[i]). */
function blockStylesToCss(s) {
  if (!s || typeof s !== "object") return "";
  const parts = [];
  if (s.color) parts.push("color:" + s.color);
  if (s.fontSize) parts.push("font-size:" + s.fontSize);
  if (s.fontFamily) parts.push("font-family:" + s.fontFamily);
  if (s.fontWeight) parts.push("font-weight:" + s.fontWeight);
  if (s.textAlign) parts.push("text-align:" + s.textAlign);
  if (s.lineHeight) parts.push("line-height:" + s.lineHeight);
  if (s.textDecoration) parts.push("text-decoration:" + s.textDecoration);
  if (s.textTransform) parts.push("text-transform:" + s.textTransform);
  if (s.backgroundColor && s.backgroundColor !== "transparent") parts.push("background-color:" + s.backgroundColor);
  return parts.join(";");
}

/** Injects per-block inline styles into section body HTML so PDF matches editor (fonts, colors, sizes). */
function injectBlockStyles(html, blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return html;
  let index = 0;
  return html.replace(/<(h2|h3|h4|p|li)(\s[^>]*)?>/gi, (match, tag, rest) => {
    const s = blocks[index];
    index += 1;
    if (!s || typeof s !== "object") return match;
    const styleStr = blockStylesToCss(s);
    if (!styleStr) return match;
    const safe = styleStr.replace(/"/g, "&quot;");
    return "<" + tag + (rest || "") + ' style="' + safe + '">';
  });
}

/** Normalize product.format for dispatch. Supports: workbook | ebook | guide | checklist | journal-prompted | journal-blank | planner | course */
function normalizeFormat(format) {
  if (!format || typeof format !== "string") return "workbook";
  const f = format.toLowerCase().trim().replace(/\s+/g, " ");
  if (f === "workbook") return "workbook";
  if (f === "ebook") return "ebook";
  if (f === "guide") return "guide";
  if (f === "spreadsheet" || f === "notion" || f === "notion template" || f === "template") return "guide";
  if (f === "checklist" || f === "checklist pack") return "checklist";
  if (f === "journal" || f === "journal prompted" || f === "prompted journal") return "journal-prompted";
  if (f === "journal blank" || f === "blank journal") return "journal-blank";
  if (f === "planner" || f === "notebook" || f === "planner notebook" || f === "notebook lined" || f === "empty notebook") return "planner";
  if (f === "course" || f === "course outline") return "course";
  return "workbook";
}

/** Convert bullet list items to checkbox form (☐) for checklist format. Returns { html, totalCount }. */
function contentToChecklistHtml(text) {
  if (!text || typeof text !== "string") return { html: "", totalCount: 0 };
  const lines = text.split(/\n/);
  let count = 0;
  const withCheckboxes = text
    .replace(/^[\s]*[-*]\s+/gm, () => { count++; return "☐ "; })
    .replace(/^[\s]*\d+\.\s+/gm, () => { count++; return "☐ "; });
  return { html: cleanMarkdownToHtml(withCheckboxes), totalCount: count };
}

/** Split content into first paragraph (objectives) and remaining (lesson breakdown). */
function splitFirstParagraph(content) {
  if (!content || typeof content !== "string") return { first: "", rest: "" };
  const trimmed = content.trim();
  const firstParaEnd = trimmed.indexOf("\n\n");
  const first = firstParaEnd === -1 ? trimmed : trimmed.slice(0, firstParaEnd);
  const rest = firstParaEnd === -1 ? "" : trimmed.slice(firstParaEnd).trim();
  return { first: cleanMarkdownToHtml(first), rest: cleanMarkdownToHtml(rest) };
}

function getIconifyUrl(content) {
  if (typeof content !== "string") return null;
  if (content.includes(":")) return `https://api.iconify.design/${encodeURIComponent(content)}.svg`;
  const iconify = LUCIDE_TO_ICONIFY[content];
  return iconify ? `https://api.iconify.design/${iconify}.svg` : null;
}

const DEFAULT_TEXT_BOX = {
  fontSize: 16,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#333333",
  textAlign: "left",
};

function parsePlacedElements(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item) =>
        item != null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.type === "string" &&
        typeof item.content === "string" &&
        item.position != null &&
        item.size != null
    )
    .map((item) => {
      const type = item.type === "text" ? "text" : item.type === "image" ? "image" : "icon";
      const base = {
        id: item.id,
        type,
        content: item.content,
        position: { x: Number(item.position?.x) || 0, y: Number(item.position?.y) || 0 },
        size: {
          width: Number(item.size?.width) || (type === "text" ? 200 : 80),
          height: Number(item.size?.height) || (type === "text" ? 48 : 80),
        },
        zIndex: Number(item.zIndex) ?? 0,
      };
      if (type === "text") {
        const ts = item.textSettings && typeof item.textSettings === "object" ? item.textSettings : {};
        return { ...base, textSettings: { ...DEFAULT_TEXT_BOX, ...ts } };
      }
      return { ...base, imageSettings: item.imageSettings };
    });
}

/**
 * Returns one background config per page. EVERY page gets background + overlay so PDF matches preview.
 * If a page has no background, use the first available (Apply-to-all behavior).
 */
/** Collect all image URLs from product (backgrounds, section images, placed images). Skip data: URLs. */
function collectImageUrls(product) {
  const urls = new Set();
  const add = (u) => {
    if (typeof u === "string" && u.trim() && !u.trim().startsWith("data:")) urls.add(u.trim());
  };
  const ds = product?.designSettings ?? {};
  const pages = ds?.pages;
  if (Array.isArray(pages)) {
    pages.forEach((p) => add(p?.backgroundImage));
  }
  add(ds?.backgroundImage ?? ds?.background_image);
  const sections = product?.content?.sections ?? [];
  sections.forEach((s) => add(s?.imageUrl));
  const placedByPage = ds?.placedElementsByPage ?? [];
  placedByPage.forEach((pageArr) => {
    if (!Array.isArray(pageArr)) return;
    pageArr.forEach((el) => {
      if (el?.type === "image" && el?.content) add(el.content);
    });
  });
  const legacy = product?.placedElements ?? [];
  if (Array.isArray(legacy)) legacy.forEach((el) => el?.type === "image" && el?.content && add(el.content));
  return Array.from(urls);
}

/** Fetch image URL and return as base64 data URL so PDF renderer doesn't need to fetch. */
async function fetchUrlToDataUrl(url, absoluteBase) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  let href = trimmed;
  if (absoluteBase && (trimmed.startsWith("/") || !/^https?:/i.test(trimmed))) {
    try {
      href = new URL(trimmed, absoluteBase).href;
    } catch {
      href = trimmed;
    }
  }
  try {
    const res = await Promise.race([
      fetch(href, { method: "GET", headers: { Accept: "image/*" } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000)),
    ]);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

/** Return a copy of product with all image URLs replaced by data URLs (so PDF has no external fetches). */
function resolveProductImages(product, urlToDataUrl) {
  const map = urlToDataUrl || new Map();
  const resolve = (u) => (typeof u === "string" && map.get(u.trim())) || u;
  const ds = product?.designSettings ?? {};
  const pages = Array.isArray(ds?.pages) ? ds.pages.slice() : [];
  const outPages = pages.map((p) => {
    if (!p || typeof p !== "object") return p;
    const bg = p.backgroundImage ? resolve(p.backgroundImage) : p.backgroundImage;
    return { ...p, backgroundImage: bg };
  });
  const sections = (product?.content?.sections ?? []).map((s) => {
    if (!s?.imageUrl) return s;
    return { ...s, imageUrl: resolve(s.imageUrl) };
  });
  let placedByPage = ds?.placedElementsByPage;
  if (Array.isArray(placedByPage)) {
    placedByPage = placedByPage.map((pageArr) => {
      if (!Array.isArray(pageArr)) return pageArr;
      return pageArr.map((el) => {
        if (el?.type !== "image" || !el?.content) return el;
        return { ...el, content: resolve(el.content) };
      });
    });
  }
  const legacyBg = ds?.backgroundImage ?? ds?.background_image;
  const resolvedLegacyBg = legacyBg ? resolve(legacyBg) : legacyBg;
  const designSettings = {
    ...ds,
    pages: outPages.length ? outPages : ds.pages,
    backgroundImage: resolvedLegacyBg,
    background_image: resolvedLegacyBg,
    placedElementsByPage: placedByPage,
  };
  return {
    ...product,
    designSettings,
    content: product?.content ? { ...product.content, sections } : product?.content,
  };
}

function parsePageBackgrounds(ds, sectionsCount) {
  const legacyBg = ds?.backgroundImage ?? ds?.background_image ?? null;
  const legacySettings = ds?.backgroundSettings ? { ...DEFAULT_IMAGE, ...ds.backgroundSettings } : undefined;
  const legacyOverlay = ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : undefined;
  const pages = ds?.pages;

  let raw = [];
  if (Array.isArray(pages) && pages.length > 0) {
    raw = pages.slice(0, Math.max(sectionsCount, pages.length)).map((p) => ({
      backgroundImage: p?.backgroundImage ?? null,
      backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE, ...p.backgroundSettings } : undefined,
      overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
    }));
  }
  while (raw.length < sectionsCount) {
    raw.push({ backgroundImage: null, backgroundSettings: undefined, overlaySettings: undefined });
  }
  raw = raw.slice(0, sectionsCount);

  const fallback = raw.find((p) => p?.backgroundImage) || (legacyBg ? { backgroundImage: legacyBg, backgroundSettings: legacySettings, overlaySettings: legacyOverlay } : null);
  return raw.map((p) => {
    const bg = p?.backgroundImage ? p : fallback;
    return {
      backgroundImage: bg?.backgroundImage ?? null,
      backgroundSettings: bg?.backgroundSettings ? { ...DEFAULT_IMAGE, ...bg.backgroundSettings } : DEFAULT_IMAGE,
      overlaySettings: bg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...bg.overlaySettings } : DEFAULT_OVERLAY,
    };
  });
}

/** Normalize overlay opacity to 0–1 (accept 0–100 from UI). */
function overlayOpacity(overlay) {
  const o = overlay?.opacity;
  if (typeof o !== "number") return 0.9;
  return o > 1 ? o / 100 : o;
}

/**
 * Wraps arbitrary inner HTML in a full page with background, overlay, and placed elements.
 * Use for all formats so PDF matches the in-app preview (same styling per page).
 */
function buildPageShell(product, pageIdx, pageCount, innerContentHtml) {
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const graphicsAccentColor = ds?.colors?.graphics ?? preset.accentColor;
  const fontFamily = preset?.fontFamily ?? "Inter, system-ui, sans-serif";
  const pageBackgrounds = parsePageBackgrounds(ds, pageCount);
  let placedElementsByPage = Array.isArray(ds.placedElementsByPage)
    ? ds.placedElementsByPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : []))
    : [];
  if (placedElementsByPage.length !== pageCount) {
    const legacy = parsePlacedElements(product?.placedElements ?? []);
    placedElementsByPage = legacy.length ? [legacy] : Array.from({ length: pageCount }, () => []);
    while (placedElementsByPage.length < pageCount) placedElementsByPage.push([]);
    placedElementsByPage = placedElementsByPage.slice(0, pageCount);
  }

  const pageBg = pageBackgrounds[pageIdx] ?? {};
  const bgUrl = pageBg.backgroundImage || null;
  const bgSettings = { ...DEFAULT_IMAGE, ...pageBg.backgroundSettings };
  const overlay = { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings };
  const opacityVal = overlayOpacity(overlay);

  const sectionStyle = `position:relative;width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;overflow:visible;page-break-after:auto;box-sizing:border-box;background-color:#fff;font-family:${escapeHtml(fontFamily)};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  let html = `<div class="section-block" style="${sectionStyle}">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    // Use CSS background with fixed attachment so each printed PDF page gets full-page coverage when section spans multiple pages
    const bgStyle = `position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:0;background-image:url(${escapeHtml(bgUrl)});background-size:cover;background-position:center;background-repeat:no-repeat;background-attachment:fixed;opacity:${bgSettings.opacity};${filter};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
    html += `<div class="pdf-bg-layer" style="${bgStyle}"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:1;background-color:${overlay.color};opacity:${opacityVal};pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
  }

  html += `<div class="section-content" style="position:relative;z-index:10;padding:60px;box-sizing:border-box;max-width:100%;min-height:${CANVAS_HEIGHT}px;font-family:${escapeHtml(fontFamily)};${bgUrl ? "background-color:transparent;" : "background-color:#fff;"}-webkit-print-color-adjust:exact;print-color-adjust:exact;">`;
  html += innerContentHtml;
  html += `</div>`;

  const elements = (placedElementsByPage[pageIdx] ?? []).slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (const el of elements) {
    const left = el.position?.x ?? 0;
    const top = el.position?.y ?? 0;
    const w = el.size?.width ?? 48;
    const h = el.size?.height ?? 48;
    const z = Math.max(1, el.zIndex || 0);
    if (el.type === "text") {
      const ts = { ...DEFAULT_TEXT_BOX, ...(el.textSettings || {}) };
      html += `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z};overflow:hidden;padding:4px;display:flex;align-items:center;word-break:break-word;font-size:${ts.fontSize}px;font-family:${escapeHtml(ts.fontFamily)};color:${escapeHtml(ts.color)};text-align:${ts.textAlign};">${escapeHtml(el.content || "")}</div>`;
    } else if (el.type === "image" && el.content) {
      const imgOp = el.imageSettings?.opacity ?? 1;
      const imgFilter = `blur(${el.imageSettings?.blur ?? 0}px) brightness(${el.imageSettings?.brightness ?? 100}%) contrast(${el.imageSettings?.contrast ?? 100}%) saturate(${el.imageSettings?.saturation ?? 100}%)`;
      html += `<img src="${escapeHtml(el.content)}" alt="" style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z};opacity:${imgOp};filter:${imgFilter};object-fit:cover;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />`;
    } else if (el.type === "icon") {
      const iconUrl = getIconifyUrl(el.content);
      if (iconUrl) {
        const color = (graphicsAccentColor || "#333").replace("#", "%23");
        html += `<img src="${iconUrl}?color=${color}" alt="" style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z};-webkit-print-color-adjust:exact;print-color-adjust:exact;" />`;
      }
    }
  }
  html += `</div>`;
  return html;
}

function buildSectionBlock({ productTitle, section, pageBg, placedElements, graphicsAccentColor, preset = null, textStyles = null }) {
  const bg = pageBg || {};
  const bgUrl = bg.backgroundImage || null;
  const bgSettings = { ...DEFAULT_IMAGE, ...bg.backgroundSettings };
  const overlay = { ...DEFAULT_OVERLAY, ...bg.overlaySettings };

  const titleColor = textStyles?.__product_title?.title?.color ?? preset?.titleColor ?? "#111";
  const headingColor = preset?.headingColor ?? "#1a1a1a";
  const bodyColor = preset?.bodyColor ?? "#333";
  const fontFamily = preset?.fontFamily ?? "Inter, system-ui, sans-serif";
  const accent = graphicsAccentColor ?? preset?.accentColor ?? "#FF6B35";

  const sectionTitleStyles = textStyles?.[section.id]?.title;
  const sectionBodyStyles = textStyles?.[section.id]?.body;
  const titleStyleColor = sectionTitleStyles?.color ?? headingColor;
  const bodyStyleColor = sectionBodyStyles?.color ?? bodyColor;
  const sectionBlockStyles = textStyles?.[section.id]?.blocks;

  const sectionTitle = escapeHtml(section.title || "(Untitled)");
  let contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(Empty)</p>");
  contentHtml = injectBlockStyles(contentHtml, sectionBlockStyles);
  const sectionImage = section.imageUrl?.trim()
    ? `<div style="margin:12px 0 16px;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:100%;height:auto;max-height:280px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
    : "";

  const sectionStyle = `position:relative;width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;overflow:visible;page-break-after:auto;box-sizing:border-box;background-color:#fff;font-family:${escapeHtml(fontFamily)};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  let html = `<div class="section-block" style="${sectionStyle}">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    const bgStyle = `position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:0;background-image:url(${escapeHtml(bgUrl)});background-size:cover;background-position:center;background-repeat:no-repeat;background-attachment:fixed;opacity:${bgSettings.opacity};${filter};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
    html += `<div class="pdf-bg-layer" style="${bgStyle}"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:1;background-color:${overlay.color};opacity:${overlayOpacity(overlay)};pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
  }

  html += `<div class="section-content" style="position:relative;z-index:10;padding:60px;box-sizing:border-box;max-width:100%;min-height:${CANVAS_HEIGHT}px;font-family:${escapeHtml(fontFamily)};${bgUrl ? "background-color:transparent;" : "background-color:#fff;"}-webkit-print-color-adjust:exact;print-color-adjust:exact;">`;
  html += `<h2 class="pdf-heading" style="font-size:24px;font-weight:bold;margin:0 0 15px;color:${escapeHtml(titleColor)};border-bottom:1px solid #ddd;padding-bottom:8px;">${escapeHtml(productTitle)}</h2>`;
  html += `<h3 class="pdf-heading" style="font-size:18px;font-weight:600;margin:0 0 15px;color:${escapeHtml(titleStyleColor)};">${sectionTitle}</h3>`;
  html += sectionImage;
  html += `<div class="pdf-body" style="margin-top:40px;font-size:15px;line-height:1.6;color:${escapeHtml(bodyStyleColor)};">${contentHtml}</div>`;
  html += `</div>`;

  const elements = (placedElements || []).slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (const el of elements) {
    const left = el.position?.x ?? 0;
    const top = el.position?.y ?? 0;
    const w = el.size?.width ?? 48;
    const h = el.size?.height ?? 48;
    const z = Math.max(1, el.zIndex || 0);

    if (el.type === "text") {
      const ts = { ...DEFAULT_TEXT_BOX, ...(el.textSettings || {}) };
      html += `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z};overflow:hidden;padding:4px;display:flex;align-items:center;word-break:break-word;font-size:${ts.fontSize}px;font-family:${escapeHtml(ts.fontFamily)};color:${escapeHtml(ts.color)};text-align:${ts.textAlign};">${escapeHtml(el.content || "")}</div>`;
    } else if (el.type === "image" && el.content) {
      const imgOp = el.imageSettings?.opacity ?? 1;
      const imgFilter = `blur(${el.imageSettings?.blur ?? 0}px) brightness(${el.imageSettings?.brightness ?? 100}%) contrast(${el.imageSettings?.contrast ?? 100}%) saturate(${el.imageSettings?.saturation ?? 100}%)`;
      html += `<img src="${escapeHtml(el.content)}" alt="" style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z};opacity:${imgOp};filter:${imgFilter};object-fit:cover;" />`;
    } else if (el.type === "icon") {
      const iconUrl = getIconifyUrl(el.content);
      if (iconUrl) {
        const color = (graphicsAccentColor || "#333").replace("#", "%23");
        html += `<img src="${iconUrl}?color=${color}" alt="" style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z};" />`;
      }
    }
  }

  html += `</div>`;
  return html;
}

/** Cover page: full-page background, title, subtitle, author. Uses first-page background or gradient. Insert as FIRST page when includeCover is true. */
function buildCoverPage(product, coverPageBg) {
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const graphicsAccentColor = ds?.colors?.graphics ?? preset.accentColor;
  const title = product?.title ?? "Product";
  const niche = product?.niche ?? "";
  const customSubtitle = product?.subtitle ?? product?.tagline ?? ds?.subtitle ?? ds?.tagline ?? "";
  const subtitle = customSubtitle ? customSubtitle : (niche ? `A comprehensive guide to ${escapeHtml(niche)}` : "");
  const author = "Created with Content Flywheel";

  const bg = coverPageBg || {};
  const bgUrl = bg.backgroundImage || null;
  const bgSettings = { ...DEFAULT_IMAGE, ...bg.backgroundSettings };
  const overlay = { ...DEFAULT_OVERLAY, ...bg.overlaySettings };

  const sectionStyle = `position:relative;width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:always;box-sizing:border-box;overflow:hidden;`;
  let html = `<div class="cover-page section-block" style="${sectionStyle}">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    const bgStyle = `position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:0;background-image:url(${escapeHtml(bgUrl)});background-size:cover;background-position:center;background-repeat:no-repeat;background-attachment:fixed;opacity:${bgSettings.opacity};${filter};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
    html += `<div class="pdf-bg-layer" style="${bgStyle}"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:1;background-color:${overlay.color};opacity:${overlayOpacity(overlay)};pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
  } else {
    const gradient = `linear-gradient(160deg, #ffffff 0%, ${graphicsAccentColor}12 40%, ${graphicsAccentColor}22 100%)`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;background:${gradient};-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background:rgba(255,255,255,0.75);pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
  }

  html += `<div class="cover-content" style="position:relative;z-index:10;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:60px;box-sizing:border-box;">`;
  html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;">`;
  html += `<h1 style="font-size:36px;font-weight:700;margin:0 0 16px;color:#111;line-height:1.2;letter-spacing:-0.02em;">${escapeHtml(title)}</h1>`;
  if (subtitle) {
    html += `<p style="font-size:18px;margin:0;color:#555;line-height:1.4;max-width:480px;">${subtitle}</p>`;
  }
  html += `</div>`;
  html += `<p style="font-size:14px;margin:0;color:#666;">${escapeHtml(author)}</p>`;
  html += `</div></div>`;
  return html;
}

/** Human-readable format label for back page. */
function getFormatLabel(format) {
  if (!format || typeof format !== "string") return "resource";
  const f = format.toLowerCase().trim();
  if (f === "workbook") return "workbook";
  if (f === "ebook") return "ebook";
  if (f === "guide") return "guide";
  if (f === "checklist" || f === "checklist pack") return "checklist pack";
  if (f === "journal") return "journal";
  if (f === "planner" || f === "notebook") return "planner";
  if (f === "course" || f === "course outline") return "course";
  if (f === "spreadsheet") return "spreadsheet";
  return "resource";
}

/** Back page: thank you, format-specific message, CTA, social placeholders, branding. Same background as cover. Insert as LAST page when includeBackPage is true. */
function buildBackPage(product, coverPageBg) {
  const ds = product?.designSettings ?? {};
  const graphicsAccentColor = ds?.colors?.graphics ?? "#FF6B35";
  const formatLabel = getFormatLabel(product?.format);

  const bg = coverPageBg || {};
  const bgUrl = bg.backgroundImage || null;
  const bgSettings = { ...DEFAULT_IMAGE, ...bg.backgroundSettings };
  const overlay = { ...DEFAULT_OVERLAY, ...bg.overlaySettings };

  const sectionStyle = `position:relative;width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;max-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:avoid;page-break-inside:avoid;box-sizing:border-box;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  let html = `<div class="back-page section-block" style="${sectionStyle}">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    const bgStyle = `position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:0;background-image:url(${escapeHtml(bgUrl)});background-size:cover;background-position:center;background-repeat:no-repeat;background-attachment:fixed;opacity:${bgSettings.opacity};${filter};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
    html += `<div class="pdf-bg-layer" style="${bgStyle}"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;min-height:${CANVAS_HEIGHT}px;z-index:1;background-color:${overlay.color};opacity:${overlayOpacity(overlay)};pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
  } else {
    const gradient = `linear-gradient(160deg, #ffffff 0%, ${graphicsAccentColor}12 40%, ${graphicsAccentColor}22 100%)`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;background:${gradient};-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background:rgba(255,255,255,0.75);pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
  }

  html += `<div class="back-content" style="position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px;box-sizing:border-box;page-break-inside:avoid;">`;
  html += `<div class="back-content-inner" style="page-break-inside:avoid;">`;
  html += `<h2 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#111;">Thank you</h2>`;
  html += `<p style="font-size:16px;margin:0 0 28px;color:#444;line-height:1.5;">Thank you for using this ${escapeHtml(formatLabel)}!</p>`;
  html += `<p style="font-size:15px;margin:0 0 28px;color:#444;line-height:1.5;">Want to create your own digital products? Visit <strong>contentflywheel.com</strong></p>`;
  html += `<div style="margin:0 0 28px;padding:16px 24px;background:rgba(0,0,0,0.04);border-radius:8px;">`;
  html += `<p style="font-size:12px;margin:0 0 6px;color:#666;font-weight:600;">Connect with us</p>`;
  html += `<p style="font-size:12px;margin:0;color:#888;">Instagram · Twitter · LinkedIn · YouTube</p>`;
  html += `</div>`;
  html += `<p style="font-size:13px;margin:0;color:#888;">Created with <strong style="color:${graphicsAccentColor};">Content Flywheel</strong></p>`;
  html += `</div></div></div>`;
  return html;
}

const TEMPLATE_PRESETS = {
  modern: { accentColor: "#FF6B35", fontFamily: "Inter, system-ui, sans-serif", titleColor: "#FF6B35", headingColor: "#1a1a1a", bodyColor: "#4a4a4a" },
  classic: { accentColor: "#2c3e50", fontFamily: "Georgia, 'Times New Roman', serif", titleColor: "#2c3e50", headingColor: "#2c3e50", bodyColor: "#34495e" },
  minimal: { accentColor: "#374151", fontFamily: "Inter, system-ui, sans-serif", titleColor: "#111827", headingColor: "#1f2937", bodyColor: "#6b7280" },
  bold: { accentColor: "#7C3AED", fontFamily: "'DM Sans', Inter, sans-serif", titleColor: "#7C3AED", headingColor: "#1a1a1a", bodyColor: "#374151" },
  elegant: { accentColor: "#6B4E71", fontFamily: "'Playfair Display', Georgia, serif", titleColor: "#6B4E71", headingColor: "#2d2d2d", bodyColor: "#5a5a5a" },
  creative: { accentColor: "#EC4899", fontFamily: "'Nunito', Inter, sans-serif", titleColor: "#EC4899", headingColor: "#1f2937", bodyColor: "#4b5563" },
};

function getTemplatePreset(ds) {
  const templateId = ds?.template ?? "modern";
  const preset = TEMPLATE_PRESETS[templateId] ?? TEMPLATE_PRESETS.modern;
  const accentOverride = ds?.colors?.graphics ?? ds?.colors?.primary ?? preset.accentColor;
  return { ...preset, accentColor: accentOverride };
}

const BASE_PAGE_CSS = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{margin:0;padding:0;orphans:3;widows:3;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .section-block{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .section-content{orphans:3;widows:3;line-height:1.6}
  .section-content .pdf-heading,.section-content h2,.section-content h3{margin-top:30px;margin-bottom:15px;page-break-after:avoid}
  .section-content .pdf-heading:first-child,.section-content h2:first-child,.section-content h3:first-child{margin-top:0}
  .section-content p{margin:0 0 16px;page-break-inside:avoid;line-height:1.6}
  .section-content ul,.section-content ol{margin:0 0 16px;padding-left:1.5rem;page-break-inside:avoid;line-height:1.6}
  .section-content li{margin-bottom:0.35em}
  .pdf-body{line-height:1.6}
  .pdf-heading{page-break-after:avoid}
  h2.pdf-heading,h3.pdf-heading{page-break-after:avoid}
  img{max-width:100%;height:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .exercise-box,.notes-space{margin:12px 0 16px;padding:16px;border:1px dashed #ccc;border-radius:8px;background:#fafafa;min-height:40px;page-break-inside:avoid}
  .example-box{margin:16px 0;padding:16px 20px;border-left:4px solid #ddd;background:#f8f9fa;border-radius:0 8px 8px 0;page-break-inside:avoid}
  .chapter-intro{margin:0 0 20px;font-style:italic;color:#555}
  .checklist-items ul{list-style:none;padding-left:0}.checklist-items li{margin-bottom:0.5em}
  table{border-collapse:collapse;margin:12px 0;width:100%;page-break-inside:avoid}table th,table td{border:1px solid #ddd;padding:8px 12px;text-align:left}
  @media print{
    *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
    /* Do not fix .pdf-bg-layer to 794x1123 here: it must fill the section-block so when a section spans multiple PDF pages the background extends to the bottom of the last page. */
  }
  .back-page,.back-page *{page-break-inside:avoid !important}
  .back-page{page-break-after:avoid !important}
`;

function getPageCss(extra = "") {
  return BASE_PAGE_CSS + (extra ? `\n${extra}\n` : "") + `@page{size:${CANVAS_WIDTH}px ${CANVAS_HEIGHT}px;margin:0;}`;
}

const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">';

function wrapFullHtml(bodyHtml, pageCss) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${FONT_LINKS}<style>${pageCss}</style></head><body style="margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${bodyHtml}</body></html>`;
}

// ----- 1. WORKBOOK: interactive worksheets (existing) -----
function buildWorkbookContent(product, options) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const pageCount = Math.max(1, sections.length);
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const graphicsAccentColor = ds?.colors?.graphics ?? preset.accentColor;
  const textStyles = ds?.textStyles ?? null;
  const pageBackgrounds = parsePageBackgrounds(ds, pageCount);
  let placedElementsByPage = Array.isArray(ds.placedElementsByPage)
    ? ds.placedElementsByPage.map((pageArr) => (Array.isArray(pageArr) ? parsePlacedElements(pageArr) : []))
    : [];
  if (placedElementsByPage.length !== pageCount) {
    const legacy = parsePlacedElements(product?.placedElements ?? []);
    placedElementsByPage = legacy.length ? [legacy] : Array.from({ length: pageCount }, () => []);
    while (placedElementsByPage.length < pageCount) placedElementsByPage.push([]);
    placedElementsByPage = placedElementsByPage.slice(0, pageCount);
  }
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  let body = "";
  for (let i = 0; i < pageCount; i++) {
    const section = secs[i] ?? { id: `page-${i}`, title: "(Untitled)", content: "", contentHtml: "" };
    const pageBg = pageBackgrounds[i] ?? null;
    const placed = placedElementsByPage[i] ?? [];
    body += buildSectionBlock({ productTitle: title, section, pageBg, placedElements: placed, graphicsAccentColor, preset, textStyles });
  }
  return body;
}

// ----- 2. EBOOK: professional book, TOC + chapters; each page wrapped with buildPageShell (backgrounds, placed elements) -----
function buildEbookContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  const titleColor = preset.titleColor;
  const headingColor = preset.headingColor;
  const bodyColor = preset.bodyColor;
  const fontFamily = preset.fontFamily;
  const textStyles = ds?.textStyles ?? null;
  const marginWide = "padding:52px 64px 52px;";
  const pageCount = 1 + secs.length;

  let tocInner = `<h2 style="font-size:22px;font-weight:700;margin:0 0 28px;color:${escapeHtml(titleColor)};border-bottom:2px solid #ddd;padding-bottom:10px;">Contents</h2>`;
  secs.forEach((sec, i) => {
    const chNum = i + 1;
    tocInner += `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${escapeHtml(bodyColor)};display:flex;justify-content:space-between;"><span>Chapter ${chNum} &mdash; ${escapeHtml(sec.title || "(Untitled)")}</span><span style="color:#888;">p. —</span></p>`;
  });
  tocInner += `<div class="ebook-footer" style="position:absolute;bottom:0;left:0;right:0;padding:12px 64px;font-size:11px;color:#888;font-family:${escapeHtml(fontFamily)};text-align:center;">— 1 —</div>`;
  let html = buildPageShell(product, 0, pageCount, tocInner);

  secs.forEach((section, i) => {
    const pageIdx = i + 1;
    const chNum = i + 1;
    const secTitleColor = textStyles?.[section.id]?.title?.color ?? headingColor;
    const secBodyColor = textStyles?.[section.id]?.body?.color ?? bodyColor;
    const sectionBlockStyles = textStyles?.[section.id]?.blocks;
    const sectionTitle = escapeHtml(section.title || "(Untitled)");
    let contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(Empty)</p>");
    contentHtml = injectBlockStyles(contentHtml, sectionBlockStyles);
    const sectionImage = section.imageUrl?.trim()
      ? `<div style="margin:16px 0 24px;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:100%;height:auto;max-height:300px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
      : "";
    let chapterInner = `<p style="font-size:12px;margin:0 0 6px;color:${escapeHtml(accent)};font-weight:600;">Chapter ${chNum}</p>`;
    chapterInner += `<h2 class="pdf-heading" style="font-size:26px;font-weight:700;margin:0 0 24px;color:${escapeHtml(secTitleColor)};">${sectionTitle}</h2>`;
    chapterInner += sectionImage;
    chapterInner += `<div class="pdf-body" style="font-size:15px;line-height:1.7;color:${escapeHtml(secBodyColor)};">${contentHtml}</div>`;
    chapterInner += `<div class="ebook-footer" style="position:absolute;bottom:0;left:0;right:0;padding:12px 64px;font-size:11px;color:#888;font-family:${escapeHtml(fontFamily)};text-align:center;">— <span class="page-number">—</span> —</div>`;
    html += buildPageShell(product, pageIdx, pageCount, chapterInner);
  });
  return html;
}

// ----- 3. GUIDE: Step 1/2/3, action boxes, progress; each page wrapped with buildPageShell -----
function buildGuideContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  const headingColor = preset.headingColor;
  const bodyColor = preset.bodyColor;
  const fontFamily = preset.fontFamily;
  const pad = "padding:40px 48px 36px;";
  const textStyles = ds?.textStyles ?? null;
  const pageCount = secs.length;
  let html = "";

  secs.forEach((section, i) => {
    const stepNum = i + 1;
    const totalSteps = secs.length;
    const stepTitle = escapeHtml(section.title || `Step ${stepNum}`).replace(/^Step \d+:\s*/i, "");
    let contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(Empty)</p>");
    contentHtml = injectBlockStyles(contentHtml, textStyles?.[section.id]?.blocks);
    const progressPct = Math.round((stepNum / totalSteps) * 100);
    const sectionImage = section.imageUrl?.trim()
      ? `<div style="margin:12px 0 16px;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:70%;height:auto;max-height:280px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
      : "";
    const secHeadingColor = textStyles?.[section.id]?.title?.color ?? headingColor;
    const secBodyColor = textStyles?.[section.id]?.body?.color ?? bodyColor;
    let inner = `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Step ${stepNum} of ${totalSteps}</p>`;
    inner += `<div style="margin-bottom:20px;height:6px;background:#eee;border-radius:3px;overflow:hidden;"><div style="width:${progressPct}%;height:100%;background:${accent};border-radius:3px;"></div></div>`;
    inner += `<h2 class="pdf-heading" style="font-size:20px;font-weight:700;margin:0 0 20px;color:${escapeHtml(secHeadingColor)};">Step ${stepNum}: ${stepTitle}</h2>`;
    inner += sectionImage;
    inner += `<div class="action-box" style="margin:0 0 20px;padding:16px 20px;background:${accent}12;border-left:4px solid ${accent};border-radius:0 8px 8px 0;">`;
    inner += `<div style="font-size:14px;line-height:1.6;color:${escapeHtml(secBodyColor)};">${contentHtml}</div></div>`;
    inner += `<div class="summary-box" style="margin-top:24px;padding:20px;background:#f8f9fa;border-radius:8px;border:1px solid #eee;">`;
    inner += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Summary</p>`;
    inner += `<p style="font-size:14px;margin:0;line-height:1.5;color:#444;">Complete Step ${stepNum} above, then move to the next.</p></div>`;
    html += buildPageShell(product, i, pageCount, inner);
  });
  return html;
}

// ----- 4. CHECKLIST PACK: ☐ by section, __ of __ completed, large checkboxes, print-optimized -----
function buildChecklistContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  let totalItems = 0;
  const sectionData = secs.map((s) => {
    const rawSource = (s.contentHtml ?? s.content ?? "").trim();
    let html;
    let count;
    if (rawSource && (rawSource.includes("<") || rawSource.includes("☐"))) {
      html = rawSource;
      const matches = rawSource.match(/☐/g);
      count = matches ? matches.length : 0;
    } else {
      const result = contentToChecklistHtml(s.content ?? "");
      html = result.html;
      count = result.totalCount;
    }
    totalItems += count;
    return { title: s.title, html: html || "<p>☐ (No items)</p>", count };
  });

  const contentPadding = "padding:36px 40px 32px;";
  const checkboxStyle = "font-size:18px;line-height:2.2;color:#111;";
  const largeCheckbox = '<span style="display:inline-block;width:24px;height:24px;border:2px solid #333;border-radius:4px;margin-right:10px;vertical-align:middle;"></span>';
  const pageCount = sectionData.length;
  let html = "";

  sectionData.forEach(({ title: catTitle, html: contentHtml }, idx) => {
    const categoryTitle = escapeHtml(catTitle || "(Untitled)");
    const withCheckboxes = contentHtml.replace(/☐/g, largeCheckbox);
    const sec = secs[idx];
    const sectionImage = sec?.imageUrl?.trim()
      ? `<div style="margin:12px 0 16px;text-align:center;"><img src="${escapeHtml(sec.imageUrl)}" alt="" style="max-width:70%;height:auto;max-height:200px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
      : "";
    let inner = `<p style="font-size:14px;font-weight:700;margin:0 0 16px;color:#111;">0 of ${totalItems} completed</p>`;
    inner += `<h2 class="pdf-heading" style="font-size:20px;font-weight:700;margin:0 0 16px;color:${accent};border-bottom:3px solid ${accent};padding-bottom:8px;">${categoryTitle}</h2>`;
    inner += sectionImage;
    inner += `<div class="pdf-body checklist-items" style="${checkboxStyle}">${withCheckboxes}</div>`;
    inner += `<p style="font-size:12px;margin:20px 0 0;color:#666;">☐ = To do &nbsp;&nbsp; ☑ = Done</p>`;
    html += buildPageShell(product, idx, pageCount, inner);
  });
  return html;
}

// ----- 5. JOURNAL (PROMPTED): one page per prompt + 20 blank lined pages; each wrapped with buildPageShell -----
function buildJournalPromptedContent(product) {
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ title: "Reflect", content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  const pad = "padding:44px 48px 40px;";
  const linesPerPage = 18;
  const lineHeight = 26;
  const pageCount = secs.length + 20;
  let html = "";

  secs.forEach((section, idx) => {
    const promptTitle = escapeHtml(section.title || "Reflect");
    const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "");
    const sectionImage = section.imageUrl?.trim()
      ? `<div style="margin:12px 0 16px;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:70%;height:auto;max-height:200px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
      : "";
    let inner = `<p style="font-size:11px;margin:0 0 16px;color:#999;">Date: ________________</p>`;
    inner += `<h3 style="font-size:16px;margin:0 0 12px;color:${accent};font-weight:600;">${promptTitle}</h3>`;
    inner += sectionImage;
    if (contentHtml) inner += `<div style="font-size:13px;line-height:1.5;color:#555;margin-bottom:24px;">${contentHtml}</div>`;
    inner += `<div style="border-bottom:1px solid #e0e0e0;height:${linesPerPage * lineHeight}px;">`;
    for (let i = 0; i < linesPerPage; i++) inner += `<div style="height:${lineHeight}px;border-bottom:1px solid #eee;"></div>`;
    inner += `</div>`;
    html += buildPageShell(product, idx, pageCount, inner);
  });
  for (let p = 0; p < 20; p++) {
    let inner = `<p style="font-size:11px;margin:0 0 20px;color:#999;">Date: ________________</p>`;
    inner += `<div style="border-bottom:1px solid #e0e0e0;height:${linesPerPage * lineHeight}px;">`;
    for (let i = 0; i < linesPerPage; i++) inner += `<div style="height:${lineHeight}px;border-bottom:1px solid #eee;"></div>`;
    inner += `</div>`;
    html += buildPageShell(product, secs.length + p, pageCount, inner);
  }
  return html;
}

// ----- 6. JOURNAL (BLANK): 50 blank lined pages, optional section dividers; each wrapped with buildPageShell -----
function buildJournalBlankContent(product) {
  const sections = product?.content?.sections ?? [];
  const dividerTitles = sections.length ? sections.map((s) => s.title || "Section") : [];
  const pageCount = 50;
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  const pad = "padding:40px 48px 50px;";
  const linesPerPage = 32;
  let html = "";
  let dividerIndex = 0;
  const dividerInterval = dividerTitles.length ? Math.max(1, Math.floor(pageCount / (dividerTitles.length + 1))) : pageCount;

  for (let p = 0; p < pageCount; p++) {
    const pageNum = p + 1;
    const isDivider = dividerTitles.length > 0 && p > 0 && p % dividerInterval === 0 && dividerIndex < dividerTitles.length;
    let inner;
    if (isDivider) {
      const divTitle = escapeHtml(dividerTitles[dividerIndex] ?? "Section");
      inner = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;"><h2 style="font-size:22px;font-weight:700;margin:0;color:${accent};">${divTitle}</h2><p style="font-size:12px;margin:24px 0 0;color:#999;">— ${pageNum} —</p></div>`;
      dividerIndex++;
    } else {
      inner = `<div style="height:${linesPerPage * 22}px;">`;
      for (let i = 0; i < linesPerPage; i++) inner += `<div style="height:22px;border-bottom:1px solid #eee;"></div>`;
      inner += `</div><p style="font-size:11px;margin:12px 0 0;text-align:center;color:#999;">${pageNum}</p>`;
    }
    html += buildPageShell(product, p, pageCount, inner);
  }
  return html;
}

// ----- 7. PLANNER/NOTEBOOK: template pages + blank lined pages; each wrapped with buildPageShell -----
function buildPlannerContent(product) {
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "t1", title: "Template", content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  const pad = "padding:36px 44px 32px;";
  const linesInBox = 12;
  const lineHeight = 22;
  const blankCount = Math.max(0, 50 - secs.length);
  const pageCount = secs.length + blankCount;
  let html = "";

  secs.forEach((section, idx) => {
    const templateTitle = escapeHtml(section.title || `Template ${idx + 1}`);
    const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(No content)</p>");
    const sectionImage = section.imageUrl?.trim()
      ? `<div style="margin:12px 0 16px;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:70%;height:auto;max-height:200px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
      : "";
    let inner = `<h2 class="pdf-heading" style="font-size:20px;font-weight:700;margin:0 0 20px;color:${accent};border-bottom:2px solid ${accent};padding-bottom:8px;">${templateTitle}</h2>`;
    inner += sectionImage;
    inner += `<div class="planner-template-body" style="font-size:14px;line-height:1.6;color:#999;margin-bottom:24px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;">`;
    inner += contentHtml;
    inner += `</div>`;
    inner += `<p style="font-size:11px;margin:0 0 8px;color:#999;">Your notes:</p>`;
    inner += `<div style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;">`;
    for (let i = 0; i < linesInBox; i++) inner += `<div style="height:${lineHeight}px;border-bottom:1px solid #eee;"></div>`;
    inner += `</div>`;
    html += buildPageShell(product, idx, pageCount, inner);
  });

  const linesPerPage = 32;
  for (let p = 0; p < blankCount; p++) {
    let inner = `<div style="height:${linesPerPage * 22}px;">`;
    for (let i = 0; i < linesPerPage; i++) inner += `<div style="height:22px;border-bottom:1px solid #e8e8e8;"></div>`;
    inner += `</div><p style="font-size:11px;margin:12px 0 0;text-align:center;color:#999;">— ${p + 1} —</p>`;
    html += buildPageShell(product, secs.length + p, pageCount, inner);
  }
  return html;
}

// ----- 8. COURSE OUTLINE: modules + certificate page; each wrapped with buildPageShell -----
function buildCourseContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const preset = getTemplatePreset(ds);
  const accent = ds?.colors?.graphics ?? preset.accentColor;
  const pad = "padding:36px 44px 32px;";
  const pageCount = secs.length + 1;
  let html = "";

  secs.forEach((section, modIndex) => {
    const moduleTitle = escapeHtml(section.title || `Module ${modIndex + 1}`);
    const rawContent = (section.contentHtml ?? section.content ?? "").trim();
    const { first: objectivesHtml, rest: lessonsHtml } = splitFirstParagraph(rawContent);
    const moduleNum = modIndex + 1;
    const sectionImage = section.imageUrl?.trim()
      ? `<div style="margin:12px 0 16px;text-align:center;"><img src="${escapeHtml(section.imageUrl)}" alt="" style="max-width:70%;height:auto;max-height:220px;object-fit:contain;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></div>`
      : "";

    let inner = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">`;
    inner += `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:${accent};color:#fff;font-size:16px;font-weight:700;border-radius:8px;">${moduleNum}</span>`;
    inner += `<h2 class="pdf-heading" style="font-size:22px;font-weight:700;margin:0;color:#111;">${moduleTitle}</h2>`;
    inner += `</div>`;
    inner += sectionImage;
    inner += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Learning objectives</p>`;
    inner += `<div style="font-size:14px;line-height:1.6;color:#333;margin-bottom:20px;">${objectivesHtml || "<p>—</p>"}</div>`;
    inner += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Lesson breakdown</p>`;
    const lessonCb = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #333;margin-right:8px;vertical-align:middle;"></span> ';
    const lessonsWithCheckboxes = (lessonsHtml || "").replace(/<li([^>]*)>/gi, (_, attrs) => `<li${attrs} style="list-style:none;">${lessonCb}`);
    inner += `<div class="course-lessons" style="font-size:14px;line-height:1.65;color:#333;margin-bottom:20px;">${lessonsWithCheckboxes || "<p>—</p>"}</div>`;
    inner += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Resources / materials</p>`;
    inner += `<ul style="margin:0 0 16px;padding-left:1.5rem;font-size:13px;color:#555;"><li>Notes for this module</li><li>☐ Mark when complete</li></ul>`;
    inner += `<p style="font-size:14px;margin:0;color:${accent};font-weight:600;">☐ Module ${moduleNum} complete</p>`;
    html += buildPageShell(product, modIndex, pageCount, inner);
  });

  const certTitle = escapeHtml(title);
  const certInner = `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px;border:3px double ${accent};"><p style="font-size:12px;margin:0 0 12px;color:#666;letter-spacing:0.2em;">CERTIFICATE OF COMPLETION</p><h2 style="font-size:24px;font-weight:700;margin:0 0 24px;color:#111;">${certTitle}</h2><p style="font-size:14px;margin:0 0 32px;color:#444;">This certifies that</p><p style="font-size:18px;font-weight:600;margin:0 0 8px;color:#111;border-bottom:1px solid #ccc;min-width:240px;">_________________________</p><p style="font-size:12px;margin:0 0 24px;color:#888;">has completed all modules.</p><p style="font-size:11px;margin:0;color:#999;">Date: ________________</p></div>`;
  html += buildPageShell(product, secs.length, pageCount, certInner);
  return html;
}

/**
 * Generates format-specific content HTML only (no cover/back). Use with buildFullHtml for full PDF.
 * @param {object} product - Product from DB (title, format, content.sections, designSettings, etc.)
 * @param {string} format - Normalized format: workbook | ebook | guide | checklist | journal-prompted | journal-blank | planner | course
 * @returns {string} HTML fragment for the body content of the PDF
 */
function buildFormatSpecificHTML(product, format) {
  const options = {};
  switch (format) {
    case "workbook":
      return buildWorkbookContent(product, options);
    case "ebook":
      return buildEbookContent(product);
    case "guide":
      return buildGuideContent(product);
    case "checklist":
      return buildChecklistContent(product);
    case "journal-prompted":
      return buildJournalPromptedContent(product);
    case "journal-blank":
      return buildJournalBlankContent(product);
    case "planner":
      return buildPlannerContent(product);
    case "course":
      return buildCourseContent(product);
    default:
      return buildWorkbookContent(product, options);
  }
}

function buildFullHtml(product, options = {}) {
  const includeCover = options.includeCover !== false;
  const includeBackPage = options.includeBackPage !== false;
  const format = normalizeFormat(product?.format);
  const ds = product?.designSettings ?? {};
  const coverPageBg = (parsePageBackgrounds(ds, 1))[0] ?? null;
  const pageCss = getPageCss();

  let body = "";
  if (includeCover) body += buildCoverPage(product, coverPageBg);
  body += buildFormatSpecificHTML(product, format);
  if (includeBackPage) body += buildBackPage(product, coverPageBg);

  return wrapFullHtml(body, pageCss);
}

/**
 * Build full HTML for PDF preview (used by GET /api/products/[id]/pdf-preview and by POST when using page.goto).
 * Fetches product, resolves images to data URLs, returns full document HTML.
 */
export async function getPdfPreviewHtml(productId, userId, options = {}) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
  if (!product) return null;

  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
  if (!baseUrl) baseUrl = "http://localhost:3000";
  baseUrl = baseUrl.replace(/\/$/, "");

  const imageUrls = collectImageUrls(product);
  const urlToDataUrl = new Map();
  await Promise.all(
    imageUrls.map(async (url) => {
      const dataUrl = await fetchUrlToDataUrl(url, baseUrl);
      if (dataUrl) urlToDataUrl.set(url, dataUrl);
    })
  );
  const resolvedProduct = resolveProductImages(product, urlToDataUrl);
  return buildFullHtml(resolvedProduct, {
    includeCover: options.includeCover !== false,
    includeBackPage: options.includeBackPage !== false,
  });
}

/**
 * POST /api/generate-pdf-puppeteer
 *
 * Server-side PDF via Puppeteer (not used by the product editor; editor uses client-side html2canvas + jsPDF).
 * Kept for server-side use if needed. Flow: auth → token → page.goto(pdf-preview) → wait → page.pdf().
 * Env: NEXT_PUBLIC_APP_URL; optional PDF_PREVIEW_SECRET.
 */
export async function POST(request) {
  let browser;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const includeCover = body.includeCover !== false;
    const includeBackPage = body.includeBackPage !== false;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
    if (!baseUrl) baseUrl = "http://localhost:3000";
    baseUrl = baseUrl.replace(/\/$/, "");

    const token = createPdfPreviewToken(productId, userId, { includeCover, includeBackPage });
    const previewUrl = `${baseUrl}/api/products/${encodeURIComponent(productId)}/pdf-preview?token=${encodeURIComponent(token)}`;

    const puppeteer = (await import("puppeteer")).default;
    browser = await puppeteer.launch({
      headless: true,
      timeout: 60000,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    await page.setViewport({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

    await page.goto(previewUrl, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Wait for fonts (Google Fonts, etc.) so PDF text matches editor
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((r) => setTimeout(r, 300));

    // Wait for all images (backgrounds, section images, placed images) to load
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalWidth !== 0) {
                resolve();
                return;
              }
              const onDone = () => resolve();
              img.onload = onDone;
              img.onerror = onDone;
              setTimeout(onDone, 20000);
            })
        )
      );
    });
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await page.pdf({
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      width: `${CANVAS_WIDTH}px`,
      height: `${CANVAS_HEIGHT}px`,
    });

    await browser.close();
    browser = null;

    const title = product.title ?? "product";
    const safeName = title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || productId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
    const fileName = `${safeName}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    console.error("Generate PDF (Puppeteer) failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
