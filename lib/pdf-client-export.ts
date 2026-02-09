/**
 * Client-side PDF export using jsPDF + html2canvas.
 * One section = one page; no server or browser automation.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { PdfProductPayload } from "@/lib/pdf-product-html";
import { buildSinglePageFragment } from "@/lib/pdf-product-html";

const PAGE_WIDTH_PX = 800;
const PAGE_HEIGHT_PX = 1100;
const PAGE_WIDTH_MM = (PAGE_WIDTH_PX / 96) * 25.4;
const PAGE_HEIGHT_MM = (PAGE_HEIGHT_PX / 96) * 25.4;

function waitForImages(container: HTMLElement, timeoutMs = 5000): Promise<void> {
  const imgs = container.querySelectorAll("img");
  if (imgs.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      Array.from(imgs).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    ).then(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Generate PDF in the browser: one PDF page per product section.
 * Returns PDF as Blob.
 */
export async function generatePdfClientSide(
  payload: PdfProductPayload,
  onProgress?: (page: number, total: number) => void
): Promise<Blob> {
  const pageCount = Math.max(1, payload.sections?.length ?? 1);

  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${PAGE_WIDTH_PX}px;
    height: ${PAGE_HEIGHT_PX}px;
    overflow: hidden;
    background: #fff;
    z-index: -1;
  `;
  document.body.appendChild(container);

  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE_WIDTH_MM, PAGE_HEIGHT_MM],
    hotfixes: ["px_scaling"],
  });

  try {
    for (let i = 0; i < pageCount; i++) {
      onProgress?.(i + 1, pageCount);
      container.innerHTML = buildSinglePageFragment(payload, i);
      await waitForImages(container, 4000);

      const pageEl = container.querySelector(".pdf-page") as HTMLElement;
      if (!pageEl) throw new Error("PDF page element not found");
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        windowWidth: PAGE_WIDTH_PX,
        windowHeight: PAGE_HEIGHT_PX,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) doc.addPage([PAGE_WIDTH_MM, PAGE_HEIGHT_MM]);
      doc.addImage(imgData, "JPEG", 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);
    }

    return doc.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}
