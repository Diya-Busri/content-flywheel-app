import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

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

/** Normalize product.format for dispatch. Supports: workbook | ebook | guide | checklist | journal-prompted | journal-blank | planner | course */
function normalizeFormat(format) {
  if (!format || typeof format !== "string") return "workbook";
  const f = format.toLowerCase().trim().replace(/\s+/g, " ");
  if (f === "workbook") return "workbook";
  if (f === "ebook") return "ebook";
  if (f === "guide") return "guide";
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

function parsePageBackgrounds(ds, sectionsCount) {
  const legacyBg = ds?.backgroundImage ?? ds?.background_image ?? null;
  const pages = ds?.pages;
  if (Array.isArray(pages) && pages.length >= sectionsCount) {
    return pages.slice(0, sectionsCount).map((p) => ({
      backgroundImage: p?.backgroundImage ?? null,
      backgroundSettings: p?.backgroundSettings ? { ...DEFAULT_IMAGE, ...p.backgroundSettings } : undefined,
      overlaySettings: p?.overlaySettings ? { ...DEFAULT_OVERLAY, ...p.overlaySettings } : undefined,
    }));
  }
  return Array.from({ length: sectionsCount }, (_, i) =>
    i === 0 && legacyBg
      ? {
          backgroundImage: legacyBg,
          backgroundSettings: ds?.backgroundSettings ? { ...DEFAULT_IMAGE, ...ds.backgroundSettings } : undefined,
          overlaySettings: ds?.overlaySettings ? { ...DEFAULT_OVERLAY, ...ds.overlaySettings } : undefined,
        }
      : {}
  );
}

function buildSectionBlock({ productTitle, section, pageBg, placedElements, graphicsAccentColor }) {
  const bg = pageBg || {};
  const bgUrl = bg.backgroundImage || null;
  const bgSettings = { ...DEFAULT_IMAGE, ...bg.backgroundSettings };
  const overlay = { ...DEFAULT_OVERLAY, ...bg.overlaySettings };

  const sectionTitle = escapeHtml(section.title || "(Untitled)");
  const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(Empty)</p>");

  const sectionStyle = `position:relative;width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;overflow:visible;page-break-after:auto;box-sizing:border-box;background-color:#fff;`;
  let html = `<div class="section-block" style="${sectionStyle}">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;"><img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:${bgSettings.fit};object-position:${bgSettings.position};opacity:${bgSettings.opacity};${filter}" /></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background-color:${overlay.color};opacity:${overlay.opacity};pointer-events:none;"></div>`;
  }

  html += `<div class="section-content" style="position:relative;z-index:10;padding:30px 30px 20px 30px;box-sizing:border-box;${bgUrl ? "background-color:transparent;" : "background-color:#fff;"}">`;
  html += `<h2 class="pdf-heading" style="font-size:24px;font-weight:bold;margin:0 0 6px;color:#111;border-bottom:1px solid #ddd;padding-bottom:6px;">${escapeHtml(productTitle)}</h2>`;
  html += `<h3 class="pdf-heading" style="font-size:18px;font-weight:600;margin:12px 0 6px;color:#FF6B35;">${sectionTitle}</h3>`;
  html += `<div class="pdf-body" style="margin-top:6px;font-size:14px;line-height:1.5;color:#333;">${contentHtml}</div>`;
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
  const graphicsAccentColor = ds?.colors?.graphics ?? "#FF6B35";
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
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;"><img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:${bgSettings.fit};object-position:${bgSettings.position};opacity:${bgSettings.opacity};${filter}" /></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background-color:${overlay.color};opacity:${overlay.opacity};pointer-events:none;"></div>`;
  } else {
    const gradient = `linear-gradient(160deg, #ffffff 0%, ${graphicsAccentColor}12 40%, ${graphicsAccentColor}22 100%)`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;background:${gradient};"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background:rgba(255,255,255,0.75);pointer-events:none;"></div>`;
  }

  html += `<div class="cover-content" style="position:relative;z-index:10;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:60px 50px 50px;box-sizing:border-box;">`;
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

  const sectionStyle = `position:relative;width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;overflow:hidden;`;
  let html = `<div class="back-page section-block" style="${sectionStyle}">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;"><img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:${bgSettings.fit};object-position:${bgSettings.position};opacity:${bgSettings.opacity};${filter}" /></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background-color:${overlay.color};opacity:${overlay.opacity};pointer-events:none;"></div>`;
  } else {
    const gradient = `linear-gradient(160deg, #ffffff 0%, ${graphicsAccentColor}12 40%, ${graphicsAccentColor}22 100%)`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;background:${gradient};"></div>`;
    html += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background:rgba(255,255,255,0.75);pointer-events:none;"></div>`;
  }

  html += `<div class="back-content" style="position:relative;z-index:10;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:50px;box-sizing:border-box;">`;
  html += `<h2 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#111;">Thank you</h2>`;
  html += `<p style="font-size:16px;margin:0 0 28px;color:#444;line-height:1.5;">Thank you for using this ${escapeHtml(formatLabel)}!</p>`;
  html += `<p style="font-size:15px;margin:0 0 28px;color:#444;line-height:1.5;">Want to create your own digital products? Visit <strong>contentflywheel.com</strong></p>`;
  html += `<div style="margin:0 0 28px;padding:16px 24px;background:rgba(0,0,0,0.04);border-radius:8px;">`;
  html += `<p style="font-size:12px;margin:0 0 6px;color:#666;font-weight:600;">Connect with us</p>`;
  html += `<p style="font-size:12px;margin:0;color:#888;">Instagram · Twitter · LinkedIn · YouTube</p>`;
  html += `</div>`;
  html += `<p style="font-size:13px;margin:0;color:#888;">Created with <strong style="color:${graphicsAccentColor};">Content Flywheel</strong></p>`;
  html += `</div></div>`;
  return html;
}

const BASE_PAGE_CSS = `
  *{box-sizing:border-box}
  body{margin:0;padding:0;orphans:3;widows:3;}
  .section-block{margin:0;padding:0;}
  .section-content{orphans:3;widows:3;}
  p{margin:0 0 0.5rem;page-break-inside:avoid;}
  .pdf-heading{page-break-after:avoid;}
  h2.pdf-heading,h3.pdf-heading{page-break-after:avoid;}
  ul,ol{margin:0 0 0.5rem;padding-left:1.5rem;page-break-inside:avoid;}
  li{margin-bottom:0.2rem}
`;

function getPageCss(extra = "") {
  return BASE_PAGE_CSS + (extra ? `\n${extra}\n` : "") + `@page{size:${CANVAS_WIDTH}px ${CANVAS_HEIGHT}px;margin:0;}`;
}

function wrapFullHtml(bodyHtml, pageCss) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${pageCss}</style></head><body style="margin:0;padding:0;">${bodyHtml}</body></html>`;
}

// ----- 1. WORKBOOK: interactive worksheets (existing) -----
function buildWorkbookContent(product, options) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const pageCount = Math.max(1, sections.length);
  const ds = product?.designSettings ?? {};
  const graphicsAccentColor = ds?.colors?.graphics ?? "#FF6B35";
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
    body += buildSectionBlock({ productTitle: title, section, pageBg, placedElements: placed, graphicsAccentColor });
  }
  return body;
}

// ----- 2. EBOOK: professional book, serif, TOC with page numbers, chapter headers, footer page numbers -----
function buildEbookContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  const pageStyle = `width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;background:#fff;`;
  const marginWide = "padding:52px 64px 52px;";
  const serif = "font-family:Georgia,'Times New Roman',serif;";
  let html = "";

  html += `<div class="section-block ebook-toc" style="${pageStyle}page-break-after:always;">`;
  html += `<div class="section-content" style="position:relative;z-index:10;${marginWide}${serif}">`;
  html += `<h2 style="font-size:22px;font-weight:700;margin:0 0 28px;color:#111;border-bottom:2px solid #ddd;padding-bottom:10px;">Contents</h2>`;
  secs.forEach((sec, i) => {
    const chNum = i + 1;
    html += `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#333;display:flex;justify-content:space-between;"><span>Chapter ${chNum} &mdash; ${escapeHtml(sec.title || "(Untitled)")}</span><span style="color:#888;">p. —</span></p>`;
  });
  html += `</div>`;
  html += `<div class="ebook-footer" style="position:absolute;bottom:0;left:0;right:0;padding:12px 64px;font-size:11px;color:#888;${serif}text-align:center;">— 1 —</div>`;
  html += `</div>`;

  secs.forEach((section, i) => {
    const chNum = i + 1;
    const sectionTitle = escapeHtml(section.title || "(Untitled)");
    const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(Empty)</p>");
    html += `<div class="section-block ebook-chapter" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${marginWide}${serif}">`;
    html += `<p style="font-size:12px;margin:0 0 6px;color:${accent};font-weight:600;">Chapter ${chNum}</p>`;
    html += `<h2 class="pdf-heading" style="font-size:26px;font-weight:700;margin:0 0 24px;color:#111;">${sectionTitle}</h2>`;
    html += `<div class="pdf-body" style="font-size:15px;line-height:1.7;color:#333;">${contentHtml}</div>`;
    html += `</div>`;
    html += `<div class="ebook-footer" style="position:absolute;bottom:0;left:0;right:0;padding:12px 64px;font-size:11px;color:#888;${serif}text-align:center;">— <span class="page-number">—</span> —</div>`;
    html += `</div>`;
  });
  return html;
}

// ----- 3. GUIDE: Step 1/2/3, Inter, action boxes, progress, summary boxes -----
function buildGuideContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  const pageStyle = `width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;background:#fff;`;
  const pad = "padding:40px 48px 36px;";
  const sans = "font-family:Inter,system-ui,-apple-system,sans-serif;";
  let html = "";

  secs.forEach((section, i) => {
    const stepNum = i + 1;
    const totalSteps = secs.length;
    const stepTitle = escapeHtml(section.title || `Step ${stepNum}`).replace(/^Step \d+:\s*/i, "");
    const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(Empty)</p>");
    const progressPct = Math.round((stepNum / totalSteps) * 100);
    html += `<div class="section-block guide-step" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${pad}${sans}">`;
    html += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Step ${stepNum} of ${totalSteps}</p>`;
    html += `<div style="margin-bottom:20px;height:6px;background:#eee;border-radius:3px;overflow:hidden;"><div style="width:${progressPct}%;height:100%;background:${accent};border-radius:3px;"></div></div>`;
    html += `<h2 class="pdf-heading" style="font-size:20px;font-weight:700;margin:0 0 20px;color:#111;">Step ${stepNum}: ${stepTitle}</h2>`;
    html += `<div class="action-box" style="margin:0 0 20px;padding:16px 20px;background:${accent}12;border-left:4px solid ${accent};border-radius:0 8px 8px 0;">`;
    html += `<div style="font-size:14px;line-height:1.6;color:#333;">${contentHtml}</div></div>`;
    html += `<div class="summary-box" style="margin-top:24px;padding:20px;background:#f8f9fa;border-radius:8px;border:1px solid #eee;">`;
    html += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Summary</p>`;
    html += `<p style="font-size:14px;margin:0;line-height:1.5;color:#444;">Complete Step ${stepNum} above, then move to the next.</p></div>`;
    html += `</div></div>`;
  });
  return html;
}

// ----- 4. CHECKLIST PACK: ☐ by section, __ of __ completed, large checkboxes, print-optimized -----
function buildChecklistContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  let totalItems = 0;
  const sectionData = secs.map((s) => {
    const { html, totalCount } = contentToChecklistHtml(s.content ?? "");
    totalItems += totalCount;
    return { title: s.title, html: html || "<p>☐ (No items)</p>", count: totalCount };
  });

  const pageStyle = `width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;background:#fff;`;
  const contentPadding = "padding:36px 40px 32px;";
  const checkboxStyle = "font-size:18px;line-height:2.2;color:#111;";
  const largeCheckbox = '<span style="display:inline-block;width:24px;height:24px;border:2px solid #333;border-radius:4px;margin-right:10px;vertical-align:middle;"></span>';
  let html = "";

  sectionData.forEach(({ title: catTitle, html: contentHtml, count }) => {
    const categoryTitle = escapeHtml(catTitle || "(Untitled)");
    const withCheckboxes = contentHtml.replace(/☐/g, largeCheckbox);
    html += `<div class="section-block checklist-category" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${contentPadding}">`;
    html += `<p style="font-size:14px;font-weight:700;margin:0 0 16px;color:#111;">0 of ${totalItems} completed</p>`;
    html += `<h2 class="pdf-heading" style="font-size:20px;font-weight:700;margin:0 0 16px;color:${accent};border-bottom:3px solid ${accent};padding-bottom:8px;">${categoryTitle}</h2>`;
    html += `<div class="pdf-body checklist-items" style="${checkboxStyle}">${withCheckboxes}</div>`;
    html += `<p style="font-size:12px;margin:20px 0 0;color:#666;">☐ = To do &nbsp;&nbsp; ☑ = Done</p>`;
    html += `</div></div>`;
  });
  return html;
}

// ----- 5. JOURNAL (PROMPTED): one page per prompt (title + follow-ups from body), then 15-20 horizontal lines for writing -----
function buildJournalPromptedContent(product) {
  const sections = product?.content?.sections ?? [];
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  const pageStyle = `width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:always;box-sizing:border-box;background:#fff;`;
  const pad = "padding:44px 48px 40px;";
  const linesPerPage = 18;
  const lineHeight = 26;
  let html = "";

  (sections.length ? sections : [{ title: "Reflect", content: "", contentHtml: "" }]).forEach((section) => {
    const promptTitle = escapeHtml(section.title || "Reflect");
    const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "");
    html += `<div class="section-block journal-page" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${pad}">`;
    html += `<p style="font-size:11px;margin:0 0 16px;color:#999;">Date: ________________</p>`;
    html += `<h3 style="font-size:16px;margin:0 0 12px;color:${accent};font-weight:600;">${promptTitle}</h3>`;
    if (contentHtml) html += `<div style="font-size:13px;line-height:1.5;color:#555;margin-bottom:24px;">${contentHtml}</div>`;
    html += `<div style="border-bottom:1px solid #e0e0e0;height:${linesPerPage * lineHeight}px;">`;
    for (let i = 0; i < linesPerPage; i++) html += `<div style="height:${lineHeight}px;border-bottom:1px solid #eee;"></div>`;
    html += `</div></div></div>`;
  });
  for (let p = 0; p < 20; p++) {
    html += `<div class="section-block journal-blank" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${pad}">`;
    html += `<p style="font-size:11px;margin:0 0 20px;color:#999;">Date: ________________</p>`;
    html += `<div style="border-bottom:1px solid #e0e0e0;height:${linesPerPage * lineHeight}px;">`;
    for (let i = 0; i < linesPerPage; i++) html += `<div style="height:${lineHeight}px;border-bottom:1px solid #eee;"></div>`;
    html += `</div></div></div>`;
  }
  return html;
}

// ----- 6. JOURNAL (BLANK): 50 blank lined pages, page numbers, optional section dividers -----
function buildJournalBlankContent(product) {
  const sections = product?.content?.sections ?? [];
  const dividerTitles = sections.length ? sections.map((s) => s.title || "Section") : [];
  const pageCount = 50;
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  const pageStyle = `width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:always;box-sizing:border-box;background:#fff;`;
  const pad = "padding:40px 48px 50px;";
  const linesPerPage = 32;
  let html = "";
  let dividerIndex = 0;
  const dividerInterval = dividerTitles.length ? Math.max(1, Math.floor(pageCount / (dividerTitles.length + 1))) : pageCount;

  for (let p = 0; p < pageCount; p++) {
    const pageNum = p + 1;
    const isDivider = dividerTitles.length > 0 && p > 0 && p % dividerInterval === 0 && dividerIndex < dividerTitles.length;
    if (isDivider) {
      const divTitle = escapeHtml(dividerTitles[dividerIndex] ?? "Section");
      html += `<div class="section-block journal-divider" style="${pageStyle}">`;
      html += `<div class="section-content" style="position:relative;z-index:10;${pad};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">`;
      html += `<h2 style="font-size:22px;font-weight:700;margin:0;color:${accent};">${divTitle}</h2>`;
      html += `<p style="font-size:12px;margin:24px 0 0;color:#999;">— ${pageNum} —</p>`;
      html += `</div></div>`;
      dividerIndex++;
    } else {
      html += `<div class="section-block journal-blank-page" style="${pageStyle}">`;
      html += `<div class="section-content" style="position:relative;z-index:10;${pad}">`;
      html += `<div style="height:${linesPerPage * 22}px;">`;
      for (let i = 0; i < linesPerPage; i++) html += `<div style="height:22px;border-bottom:1px solid #eee;"></div>`;
      html += `</div><p style="font-size:11px;margin:12px 0 0;text-align:center;color:#999;">${pageNum}</p>`;
      html += `</div></div>`;
    }
  }
  return html;
}

// ----- 7. PLANNER/NOTEBOOK: template pages with section content (boxes, example text in light gray), then lined area -----
function buildPlannerContent(product) {
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "t1", title: "Template", content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  const pageStyle = `width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;background:#fff;`;
  const pad = "padding:36px 44px 32px;";
  const linesInBox = 12;
  const lineHeight = 22;
  let html = "";

  secs.forEach((section, idx) => {
    const templateTitle = escapeHtml(section.title || `Template ${idx + 1}`);
    const contentHtml = section.contentHtml ? section.contentHtml : (cleanMarkdownToHtml(section.content ?? "") || "<p>(No content)</p>");
    html += `<div class="section-block planner-template" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${pad}">`;
    html += `<h2 class="pdf-heading" style="font-size:20px;font-weight:700;margin:0 0 20px;color:${accent};border-bottom:2px solid ${accent};padding-bottom:8px;">${templateTitle}</h2>`;
    html += `<div class="planner-template-body" style="font-size:14px;line-height:1.6;color:#999;margin-bottom:24px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;">`;
    html += contentHtml;
    html += `</div>`;
    html += `<p style="font-size:11px;margin:0 0 8px;color:#999;">Your notes:</p>`;
    html += `<div style="border:1px solid #e8e8e8;border-radius:4px;padding:8px;">`;
    for (let i = 0; i < linesInBox; i++) html += `<div style="height:${lineHeight}px;border-bottom:1px solid #eee;"></div>`;
    html += `</div></div></div>`;
  });

  const pageCount = Math.max(0, 50 - secs.length);
  const fullPageStyle = `width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:always;box-sizing:border-box;background:#fff;`;
  const linesPerPage = 32;
  for (let p = 0; p < pageCount; p++) {
    html += `<div class="section-block planner-page" style="${fullPageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${pad}">`;
    html += `<div style="height:${linesPerPage * 22}px;">`;
    for (let i = 0; i < linesPerPage; i++) html += `<div style="height:22px;border-bottom:1px solid #e8e8e8;"></div>`;
    html += `</div><p style="font-size:11px;margin:12px 0 0;text-align:center;color:#999;">— ${p + 1} —</p>`;
    html += `</div></div>`;
  }
  return html;
}

// ----- 8. COURSE OUTLINE: modules, objectives (first para), lesson breakdown, resources, completion + certificate -----
function buildCourseContent(product) {
  const title = product?.title ?? "Product";
  const sections = product?.content?.sections ?? [];
  const secs = sections.length ? sections : [{ id: "1", title: title, content: "", contentHtml: "" }];
  const ds = product?.designSettings ?? {};
  const accent = ds?.colors?.graphics ?? "#FF6B35";
  const pageStyle = `width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;background:#fff;`;
  const pad = "padding:36px 44px 32px;";
  let html = "";

  secs.forEach((section, modIndex) => {
    const moduleTitle = escapeHtml(section.title || `Module ${modIndex + 1}`);
    const rawContent = section.content ?? "";
    const { first: objectivesHtml, rest: lessonsHtml } = splitFirstParagraph(rawContent);
    const moduleNum = modIndex + 1;

    html += `<div class="section-block course-module" style="${pageStyle}">`;
    html += `<div class="section-content" style="position:relative;z-index:10;${pad}">`;
    html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">`;
    html += `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:${accent};color:#fff;font-size:16px;font-weight:700;border-radius:8px;">${moduleNum}</span>`;
    html += `<h2 class="pdf-heading" style="font-size:22px;font-weight:700;margin:0;color:#111;">${moduleTitle}</h2>`;
    html += `</div>`;
    html += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Learning objectives</p>`;
    html += `<div style="font-size:14px;line-height:1.6;color:#333;margin-bottom:20px;">${objectivesHtml || "<p>—</p>"}</div>`;
    html += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Lesson breakdown</p>`;
    const lessonCb = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #333;margin-right:8px;vertical-align:middle;"></span> ';
    const lessonsWithCheckboxes = (lessonsHtml || "").replace(/<li([^>]*)>/gi, (_, attrs) => `<li${attrs} style="list-style:none;">${lessonCb}`);
    html += `<div class="course-lessons" style="font-size:14px;line-height:1.65;color:#333;margin-bottom:20px;">${lessonsWithCheckboxes || "<p>—</p>"}</div>`;
    html += `<p style="font-size:12px;margin:0 0 8px;color:#666;font-weight:600;">Resources / materials</p>`;
    html += `<ul style="margin:0 0 16px;padding-left:1.5rem;font-size:13px;color:#555;"><li>Notes for this module</li><li>☐ Mark when complete</li></ul>`;
    html += `<p style="font-size:14px;margin:0;color:${accent};font-weight:600;">☐ Module ${moduleNum} complete</p>`;
    html += `</div></div>`;
  });

  const certTitle = escapeHtml(title);
  const pageStyleCert = `width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;min-height:${CANVAS_HEIGHT}px;margin:0;padding:0;page-break-after:auto;box-sizing:border-box;background:#fff;`;
  html += `<div class="section-block course-certificate" style="${pageStyleCert}">`;
  html += `<div class="section-content" style="position:relative;z-index:10;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px;border:3px double ${accent};">`;
  html += `<p style="font-size:12px;margin:0 0 12px;color:#666;letter-spacing:0.2em;">CERTIFICATE OF COMPLETION</p>`;
  html += `<h2 style="font-size:24px;font-weight:700;margin:0 0 24px;color:#111;">${certTitle}</h2>`;
  html += `<p style="font-size:14px;margin:0 0 32px;color:#444;">This certifies that</p>`;
  html += `<p style="font-size:18px;font-weight:600;margin:0 0 8px;color:#111;border-bottom:1px solid #ccc;min-width:240px;">_________________________</p>`;
  html += `<p style="font-size:12px;margin:0 0 24px;color:#888;">has completed all modules.</p>`;
  html += `<p style="font-size:11px;margin:0;color:#999;">Date: ________________</p>`;
  html += `</div></div>`;
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
 * POST /api/generate-pdf-puppeteer
 * Body: { productId: string, includeCover?: boolean, includeBackPage?: boolean }
 * Fetches product from DB, builds HTML, renders PDF with Puppeteer (setContent).
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

    const fullHtml = buildFullHtml(product, { includeCover, includeBackPage });

    const puppeteer = (await import("puppeteer")).default;
    browser = await puppeteer.launch({
      headless: true,
      timeout: 60000,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    await page.setViewport({ width: CANVAS_WIDTH + 100, height: CANVAS_HEIGHT + 100 });

    await page.setContent(fullHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: false,
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
