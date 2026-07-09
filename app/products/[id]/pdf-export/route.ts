import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import { cleanMarkdownToHtml } from "@/lib/clean-markdown";
import {
  TEMPLATE_PRESETS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_OVERLAY,
  type TemplateId,
} from "@/lib/product-print-constants";

/**
 * Escape HTML so user content cannot break the document.
 */
function escapeHtml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Make URL absolute for background-image (required for print).
 */
function absoluteBgUrl(url: string | null | undefined, origin: string): string {
  if (!url || typeof url !== "string") return "";
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("//")) return "https:" + u;
  return origin + (u.startsWith("/") ? u : "/" + u);
}

/**
 * Safe for use inside style="background-image: url(...)"
 */
function safeCssUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/"/g, "%22").replace(/'/g, "%27");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { id } = await params;
    if (!id) {
      return new NextResponse("Product ID required", { status: 400 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));

    if (!product) {
      return new NextResponse("Product not found", { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const content = product.content as { sections?: Array<{ id: string; title: string; content: string }> };
    const sections = content?.sections ?? [];
    const ds = (product.designSettings ?? {}) as Record<string, unknown>;
    const pagesBg = (ds.pages as Array<{ backgroundImage?: string | null; backgroundSettings?: Record<string, unknown>; overlaySettings?: Record<string, unknown> }>) ?? [];
    const placedByPage = (ds.placedElementsByPage as Array<Array<{ type?: string; content?: string; position?: { x: number; y: number }; size?: { width: number; height: number }; zIndex?: number }>>) ?? [];
    const template = (ds.template as string) ?? "modern";
    const preset = TEMPLATE_PRESETS[(template as TemplateId) || "modern"] ?? TEMPLATE_PRESETS.modern;
    const layout = (ds.layout as Record<string, unknown>) ?? {};
    const colors = (ds.colors as Record<string, string>) ?? {};
    const graphicsColor = colors?.graphics ?? preset.titleColor ?? "#333";
    const textStyles = (ds.textStyles as Record<string, { title?: { color?: string }; body?: { color?: string } }>) ?? {};

    const totalPages = Math.max(sections.length, pagesBg.length, placedByPage.length, 1);
    const productPages = (product as { pages?: unknown[] }).pages;
    console.log("PDF export – Total pages:", totalPages, "sections:", sections.length, "pageBackgrounds:", pagesBg.length, "placedByPage:", placedByPage.length, "product.pages:", productPages?.length ?? "N/A");
    sections.forEach((s, i) => console.log(`Section ${i}:`, s.title));
    pagesBg.forEach((p, i) => console.log(`Page bg ${i}:`, p?.backgroundImage ? "set" : "none"));

    const title = escapeHtml(product.title ?? "Product");

    const margins = (layout.margins as number) ?? 2;
    const paragraphSpacing = (layout.paragraphSpacing as number) ?? 1;
    const lineHeight = (layout.lineHeight as number) ?? 1.6;
    const alignment = (layout.alignment as string) ?? "left";
    const sectionSpacing = (layout.sectionSpacing as number) ?? 2;

    const pageDivs: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      const section = sections[i] ?? { id: `page-${i}`, title: "", content: "" };
      const pageBg = pagesBg[i];
      const bgRaw = pageBg?.backgroundImage ?? null;
      const bgAbsolute = absoluteBgUrl(bgRaw, origin);
      const bgSettings = pageBg?.backgroundSettings ? { ...DEFAULT_IMAGE_SETTINGS, ...pageBg.backgroundSettings } : DEFAULT_IMAGE_SETTINGS;
      const overlay = pageBg?.overlaySettings ? { ...DEFAULT_OVERLAY, ...pageBg.overlaySettings } : DEFAULT_OVERLAY;

      const bgInlineStyle = bgAbsolute
        ? `background-image: url('${safeCssUrl(bgAbsolute)}'); background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important;`
        : "background: #fff;";

      const sectionTitle = escapeHtml(section.title ?? "");
      const rawContent = section.content ?? "";
      const contentHtml = rawContent ? cleanMarkdownToHtml(rawContent) : "";
      const safeContent = contentHtml.replace(/<\/div>/gi, "&lt;/div&gt;");

      const titleColor = textStyles[section.id]?.title?.color ?? preset.titleColor;
      const bodyColor = textStyles[section.id]?.body?.color ?? preset.bodyColor;
      const headingColor = preset.headingColor;

      const ovColor = String(overlay.color ?? "rgba(255,255,255,0.9)").replace(/"/g, "'");
      const bgLayer =
        bgAbsolute
          ? `<div class="bg-img-layer" style="opacity:${bgSettings.opacity ?? 1};"><img src="${safeCssUrl(bgAbsolute)}" alt="" class="bg-img" style="object-fit:${bgSettings.fit ?? "cover"};object-position:${bgSettings.position ?? "center center"};"></div>
  <div class="bg-overlay" style="background-color:${ovColor};opacity:${overlay.opacity};"></div>`
          : "";

      const elements = (placedByPage[i] ?? []).slice().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      let elementsHtml = "";
      for (const el of elements) {
        const left = el.position?.x ?? 0;
        const top = el.position?.y ?? 0;
        const w = el.size?.width ?? 48;
        const h = el.size?.height ?? 48;
        const style = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${Math.max(1, el.zIndex ?? 0)};object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
        if (el.type === "image" && el.content) {
          const imgSrc = absoluteBgUrl(el.content, origin);
          if (imgSrc) elementsHtml += `<img src="${safeCssUrl(imgSrc)}" alt="" class="placed-img" style="${style}">`;
        } else if (el.type === "icon" && el.content) {
          const c = String(el.content);
          if (c.includes(":")) {
            const [prefix, name] = c.split(":");
            const iconSrc = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
            elementsHtml += `<img src="${iconSrc}" alt="" class="placed-icon" style="${style}color:${graphicsColor};" onerror="this.style.display='none'">`;
          } else {
            elementsHtml += `<span class="placed-icon" style="${style}display:flex;align-items:center;justify-content:center;font-size:${Math.min(w, h) * 0.6}px;color:${graphicsColor};">&#9733;</span>`;
          }
        }
      }

      pageDivs.push(`<div class="pdf-page" style="${bgInlineStyle}">
  ${bgLayer}
  <div class="page-inner">
    <h1 class="product-title" style="color:${titleColor};">${title}</h1>
    <h2 class="section-title" style="color:${headingColor};">${sectionTitle}</h2>
    <div class="page-content" style="color:${bodyColor};">${safeContent || "(Empty)"}</div>
  </div>
  <div class="placed-layer">${elementsHtml}</div>
</div>`);
    }
    const pageDivsHtml = pageDivs.join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - PDF Export</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;600&family=DM+Sans:wght@400;600&family=Nunito:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    @page { size: A4; margin: 0; }
    body { margin: 0; padding: 0; background: #fff; font-family: ${preset.fontFamily}; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .pdf-page {
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      max-height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .pdf-page:last-child { page-break-after: auto; }
    .bg-img-layer { position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .bg-img { width: 100%; height: 100%; object-fit: cover; object-position: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .bg-overlay { position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page-inner {
      position: relative;
      z-index: 2;
      padding: ${margins}rem;
      height: 100%;
      overflow: hidden;
      max-width: ${CANVAS_WIDTH}px;
      margin: 0 auto;
      transform: scale(0.92);
      transform-origin: top left;
      width: 108%;
    }
    .product-title { font-size: 1.5rem; font-weight: 700; margin-bottom: ${paragraphSpacing}rem; padding-bottom: 0.5rem; border-bottom: 2px solid currentColor; }
    .section-title { font-size: 1.125rem; font-weight: 600; margin-top: ${sectionSpacing * 0.75}rem; margin-bottom: ${paragraphSpacing}rem; }
    .page-content { font-size: 0.75rem; line-height: ${lineHeight}; text-align: ${alignment}; overflow: hidden; overflow-wrap: break-word; word-wrap: break-word; }
    .page-content p { margin-bottom: ${paragraphSpacing}rem; }
    .page-content h2, .page-content h3 { margin-top: ${sectionSpacing * 0.75}rem; margin-bottom: ${paragraphSpacing}rem; text-align: ${alignment}; }
    .page-content ul, .page-content ol { margin-bottom: ${paragraphSpacing}rem; padding-left: 1.5rem; }
    .page-content li { margin-bottom: 0.5rem; }
    .page-content table { border-collapse: collapse; width: 100%; margin-bottom: ${paragraphSpacing}rem; font-size: 0.7rem; }
    .page-content th, .page-content td { border: 1px solid #d1d5db; padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; }
    .page-content th { background-color: #f3f4f6; font-weight: 600; color: #111827; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page-content tr:nth-child(even) td { background-color: #f9fafb; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page-content code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 3px; font-family: monospace; font-size: 0.65rem; }
    .placed-layer { position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none; z-index: 3; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .placed-img, .placed-icon { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  </style>
</head>
<body>
<!-- PDF Export: ${totalPages} pages (sections: ${sections.length}, backgrounds: ${pagesBg.length}) -->
${pageDivsHtml || `<div class="pdf-page" style="background: #fff;"><div class="page-inner"><h1 class="product-title">${title}</h1><p>No content.</p></div></div>`}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF export failed:", err);
    return new NextResponse("Failed to generate PDF export", { status: 500 });
  }
}
