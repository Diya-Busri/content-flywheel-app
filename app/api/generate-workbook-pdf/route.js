import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 60;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1100;
const PDF_WIDTH_MM = (CANVAS_WIDTH / 96) * 25.4;
const PDF_HEIGHT_MM = (CANVAS_HEIGHT / 96) * 25.4;

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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getIconifyUrl(content) {
  if (typeof content !== "string") return null;
  if (content.includes(":")) return `https://api.iconify.design/${encodeURIComponent(content)}.svg`;
  const iconify = LUCIDE_TO_ICONIFY[content];
  return iconify ? `https://api.iconify.design/${iconify}.svg` : null;
}

function buildPageHtml(pageIndex, { productTitle, section, pageBg, placedElements, graphicsAccentColor }) {
  const bg = pageBg || {};
  const bgUrl = bg.backgroundImage || null;
  const bgSettings = { ...DEFAULT_IMAGE, ...bg.backgroundSettings };
  const overlay = { ...DEFAULT_OVERLAY, ...bg.overlaySettings };

  const contentHtml = section.contentHtml || section.content || "";
  const sectionTitle = escapeHtml(section.title || "(Untitled)");
  const bodyHtml = contentHtml ? contentHtml : "<p>(Empty)</p>";

  const css =
    "*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif}p{margin:0 0 0.75rem}h2,h3{margin:0 0 0.5rem}ul,ol{margin:0 0 0.75rem;padding-left:1.5rem}li{margin-bottom:0.25rem}";

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0;">`;
  html += `<div style="position:relative;width:${CANVAS_WIDTH}px;min-height:${CANVAS_HEIGHT}px;overflow:hidden;">`;

  if (bgUrl) {
    const filter =
      (bgSettings.blur || 0) > 0
        ? `filter:blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`
        : `filter:brightness(${bgSettings.brightness}%) contrast(${bgSettings.contrast}%) saturate(${bgSettings.saturation}%);`;
    html += `<div style="position:absolute;inset:0;z-index:0;"><img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${bgSettings.fit};object-position:${bgSettings.position};opacity:${bgSettings.opacity};${filter}" /></div>`;
    html += `<div style="position:absolute;inset:0;z-index:1;background-color:${overlay.color};opacity:${overlay.opacity};pointer-events:none;"></div>`;
  }

  html += `<div style="position:relative;z-index:10;padding:24px;min-height:${CANVAS_HEIGHT}px;${bgUrl ? "background-color:transparent;" : "background-color:#fff;"}">`;
  html += `<h2 style="font-size:24px;font-weight:bold;margin:0 0 8px;color:#111;border-bottom:1px solid #ddd;padding-bottom:8px;">${escapeHtml(productTitle)}</h2>`;
  html += `<h3 style="font-size:18px;font-weight:600;margin:16px 0 8px;color:#FF6B35;">${sectionTitle}</h3>`;
  html += `<div style="margin-top:8px;font-size:14px;line-height:1.6;color:#333;">${bodyHtml}</div>`;
  html += `</div>`;

  const elements = (placedElements || []).slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (const el of elements) {
    const left = el.position?.x ?? 0;
    const top = el.position?.y ?? 0;
    const w = el.size?.width ?? 48;
    const h = el.size?.height ?? 48;
    const z = Math.max(1, el.zIndex || 0);

    if (el.type === "image" && el.content) {
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

  html += `</div></body></html>`;
  return html;
}

/**
 * POST /api/generate-workbook-pdf
 * Body: { title, sections, pageBackgrounds?, placedElementsByPage?, graphicsAccentColor? }
 * Uses Puppeteer for pixel-perfect PDF generation.
 */
export async function POST(request) {
  let browser;

  try {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const rawSections = Array.isArray(body.sections) ? body.sections : [];
    const sections = rawSections.map((s) => ({
      id: s.id,
      title: typeof s.title === "string" ? s.title : "(Untitled)",
      content: typeof s.content === "string" ? s.content : "",
      contentHtml: typeof s.contentHtml === "string" ? s.contentHtml : undefined,
    }));

    const pageBackgrounds = Array.isArray(body.pageBackgrounds) ? body.pageBackgrounds : [];
    const placedElementsByPage = Array.isArray(body.placedElementsByPage) ? body.placedElementsByPage : [];
    const graphicsAccentColor = typeof body.graphicsAccentColor === "string" ? body.graphicsAccentColor : "#333";

    const pageCount = Math.max(
      1,
      sections.length || 0,
      pageBackgrounds.length || 0,
      placedElementsByPage.length || 0
    );
    const secs =
      sections && sections.length > 0
        ? sections
        : [{ id: "1", title: title || "Workbook", content: "", contentHtml: "" }];

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

    const pdfBuffers = [];

    for (let i = 0; i < pageCount; i++) {
      const section = secs[i] || { id: `page-${i}`, title: "(Untitled)", content: "", contentHtml: "" };
      const pageBg = (pageBackgrounds && pageBackgrounds[i]) || null;
      const placed = (placedElementsByPage && placedElementsByPage[i]) || [];

      const pageHtml = buildPageHtml(i, {
        productTitle: title || "Workbook",
        section,
        pageBg,
        placedElements: placed,
        graphicsAccentColor,
      });

      await page.setContent(pageHtml, {
        waitUntil: "networkidle0",
        timeout: 60000,
      });
      await page.evaluate(() => document.fonts?.ready);
      await new Promise((r) => setTimeout(r, 200));

      const pdfBuffer = await page.pdf({
        width: `${PDF_WIDTH_MM}mm`,
        height: `${PDF_HEIGHT_MM}mm`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      pdfBuffers.push(Buffer.from(pdfBuffer));
    }

    await browser.close();
    browser = null;

    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const src = await PDFDocument.load(buf);
      const copiedPages = await mergedPdf.copyPages(src, src.getPageIndices());
      copiedPages.forEach((p) => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();
    const safeName = (title || "workbook").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "workbook";
    const fileName = `${safeName}.pdf`;

    return new NextResponse(Buffer.from(mergedBytes), {
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
    console.error("Generate workbook PDF failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
