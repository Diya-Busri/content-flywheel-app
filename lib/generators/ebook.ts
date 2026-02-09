import { jsPDF } from "jspdf";
import type { ProductDetails } from "./types";
import { addPageBackground, addPlacedElementsToPage, hexToRgb } from "./pdf-utils";

function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Generate PDF that matches the editor 1:1: one PDF page per section (editor page).
 * Each page uses the exact same background, overlay, and content as the editor.
 * pageBackgrounds[i] and placedElementsByPage[i] correspond to section i.
 */
export async function generateEbook(details: ProductDetails): Promise<ArrayBuffer> {
  const doc = new jsPDF({ compress: false });
  const title = details.title || "Untitled Guide";
  const pageBackgrounds = details.pageBackgrounds ?? [];
  const sections = details.sections ?? [{ title: "Content", body: "Your content here." }];
  const layout = details.designSettings?.layout;
  const colors = details.designSettings?.colors;
  const placedByPage = details.placedElementsByPage ?? [];
  const marginMm = (layout?.margins ?? 2) * 10;
  const contentWidth = 210 - marginMm * 2;

  const [tr, tg, tb] = hexToRgb(colors?.title ?? "#333333");
  const [hr, hg, hb] = hexToRgb(colors?.heading ?? "#333333");
  const [br, bg, bb] = hexToRgb(colors?.body ?? "#555555");

  const CANVAS_W_PX = 800;
  const CANVAS_H_PX = 1100;

  for (let idx = 0; idx < sections.length; idx++) {
    if (idx > 0) doc.addPage();
    const section = sections[idx];
    const pageBg = pageBackgrounds[idx] ?? pageBackgrounds[0];
    await addPageBackground(doc, pageBg);
    const pageElements = placedByPage[idx];
    if (pageElements?.length) {
      await addPlacedElementsToPage(doc, pageElements, CANVAS_W_PX, CANVAS_H_PX);
    }
    let y = marginMm + 8;
    if (idx === 0) {
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(tr, tg, tb);
      doc.text(title, marginMm, y, { maxWidth: contentWidth });
      y += 14;
    }
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(hr, hg, hb);
    doc.text(section.title, marginMm, y, { maxWidth: contentWidth });
    y += 12;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(br, bg, bb);
    const bodyText = stripHtml(section.body);
    const lines = doc.splitTextToSize(bodyText, contentWidth);
    doc.text(lines, marginMm, y);
  }

  return doc.output("arraybuffer");
}
