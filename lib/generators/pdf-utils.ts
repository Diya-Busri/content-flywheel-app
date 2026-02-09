import type { jsPDF } from "jspdf";
import type { PageBackground, PlacedElementExport } from "./types";

const A4_W = 210;
const A4_H = 297;

/** Convert hex color to RGB tuple for jsPDF setTextColor/setFillColor */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [51, 51, 51];
}

/**
 * Parse overlay color from editor format: rgba(r,g,b,a) or hex.
 * Editor uses rgba(255, 255, 255, 0.9) for light overlays - we must parse this.
 */
function parseOverlayColor(
  color: string
): { r: number; g: number; b: number } {
  const s = typeof color === "string" ? color.trim() : "";
  const rgbaMatch = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/i);
  if (rgbaMatch) {
    return {
      r: Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10))),
      g: Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10))),
      b: Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10))),
    };
  }
  const [r, g, b] = hexToRgb(s || "#ffffff");
  return { r, g, b };
}

/**
 * Normalize overlay opacity: editor uses 0-1 (e.g. 0.2 = 20%).
 * If value > 1, treat as 0-100 scale and convert.
 */
function normalizeOverlayOpacity(opacity: unknown): number {
  if (typeof opacity !== "number") return 0.2;
  if (opacity > 1) return Math.max(0, Math.min(1, opacity / 100));
  return Math.max(0, Math.min(1, opacity));
}

/** Resolve image URL/data URL to base64 and format for jsPDF */
async function getImageData(
  src: string
): Promise<{ data: string; format: "JPEG" | "PNG" } | null> {
  const trimmed = typeof src === "string" ? src.trim() : "";
  if (!trimmed) return null;

  // Data URL (e.g. data:image/png;base64,...)
  const dataUrlMatch = trimmed.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (dataUrlMatch) {
    const format = dataUrlMatch[1].toLowerCase() === "png" ? "PNG" : "JPEG";
    return { data: dataUrlMatch[2], format };
  }

  // HTTP(S) URL – fetch and convert to base64
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const res = await fetch(trimmed, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const contentType = res.headers.get("content-type") || "";
      const format = contentType.includes("png") ? "PNG" : "JPEG";
      return { data: base64, format };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Draw overlay rectangle (color + opacity) over the full page.
 * Uses EXACT same logic as editor: parse rgba() or hex, opacity 0-1 (or 0-100 normalized).
 * When opacity is 0, skip overlay so fill-in lines and text stay visible.
 */
function addPageOverlay(doc: jsPDF, pageBg: PageBackground | undefined): void {
  const overlay = pageBg?.overlaySettings;
  if (!overlay) return;
  const opacity = normalizeOverlayOpacity(overlay.opacity);
  if (opacity <= 0) return;
  const colorStr = overlay.color ?? "rgba(255, 255, 255, 0.5)";
  const { r, g, b } = parseOverlayColor(colorStr);
  const d = doc as unknown as { setGState?: (g: unknown) => void; GState?: new (p: { opacity: number }) => unknown };
  try {
    doc.saveGraphicsState();
    if (typeof d.setGState === "function" && typeof d.GState === "function") {
      d.setGState(new d.GState({ opacity }));
    }
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, A4_W, A4_H, "F");
    doc.restoreGraphicsState();
  } catch {
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, A4_W, A4_H, "F");
  }
}

/**
 * Add a page background image to the current jsPDF page, then overlay if present.
 * Call this after switching to a page (e.g. after addPage()) and before adding content.
 * Uses exact URLs from editor so PDF matches what user designed.
 */
export async function addPageBackground(
  doc: jsPDF,
  pageBg: PageBackground | undefined
): Promise<void> {
  const url = pageBg?.backgroundImage;
  const bgSettings = pageBg?.backgroundSettings;
  const opacity = typeof bgSettings?.opacity === "number" ? Math.max(0, Math.min(1, bgSettings.opacity)) : 1;

  if (url && typeof url === "string") {
    const img = await getImageData(url.trim());
    if (img) {
      try {
        const pageW = A4_W;
        const pageH = A4_H;
        const fit = bgSettings?.fit ?? "cover";
        const d = doc as unknown as { setGState?: (g: unknown) => void; GState?: new (p: { opacity: number }) => unknown };
        if (opacity < 1 && typeof d.setGState === "function" && typeof d.GState === "function") {
          doc.saveGraphicsState();
          d.setGState(new d.GState({ opacity }));
        }
        if (fit === "contain") {
          doc.addImage(img.data, img.format, 0, 0, pageW, pageH);
        } else {
          doc.addImage(img.data, img.format, 0, 0, pageW, pageH);
        }
        if (opacity < 1) doc.restoreGraphicsState();
      } catch {
        // skip if image fails
      }
    }
  }

  addPageOverlay(doc, pageBg);
}

/**
 * Add placed elements (images/icons) to the current jsPDF page.
 * Scales position/size from canvas pixels (800px width) to A4 mm.
 */
export async function addPlacedElementsToPage(
  doc: jsPDF,
  elements: PlacedElementExport[],
  pageWidthPx: number,
  pageHeightPx: number
): Promise<void> {
  const scaleX = A4_W / pageWidthPx;
  const scaleY = A4_H / pageHeightPx;
  for (const el of elements) {
    const content = typeof el.content === "string" ? el.content.trim() : "";
    if (!content) continue;
    const img = await getImageData(content);
    if (!img) continue;
    const x = (el.position?.x ?? 0) * scaleX;
    const y = (el.position?.y ?? 0) * scaleY;
    const w = (el.size?.width ?? 80) * scaleX;
    const h = (el.size?.height ?? 80) * scaleY;
    try {
      doc.addImage(img.data, img.format, x, y, w, h);
    } catch {
      // skip unsupported or failed image
    }
  }
}
