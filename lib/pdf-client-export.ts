/**
 * Client-side PDF export: one screenshot per editor page div, one PDF page per screenshot.
 * Uses html2canvas on each .preview-page element (full content, no clipping), then adds each
 * image as its own full page in the jsPDF document. No splitting of one long screenshot.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const CAPTURE_SCALE = 2;

/** Convert px to mm at 96dpi for jsPDF. */
function pxToMm(px: number): number {
  return (px / 96) * 25.4;
}

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
 * Capture a container that has .preview-page children and return a PDF blob.
 * Each .preview-page is screenshot once in full (no width/height clamp); each screenshot
 * becomes exactly one PDF page. No splitting of a single screenshot across pages.
 */
export async function captureCanvasPagesToPdf(
  container: HTMLElement,
  onProgress?: (page: number, total: number) => void
): Promise<Blob> {
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".preview-page"));
  if (pages.length === 0) {
    throw new Error("No .preview-page elements found in container");
  }

  await waitForImages(container, 6000);

  let doc: jsPDF | null = null;

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i + 1, pages.length);
    const pageEl = pages[i]!;

    // Screenshot this page div in full — no width/height so the entire element is captured
    const canvas = await html2canvas(pageEl, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 0,
      scrollX: 0,
      scrollY: 0,
    });

    const wPx = canvas.width / CAPTURE_SCALE;
    const hPx = canvas.height / CAPTURE_SCALE;
    const wMm = pxToMm(wPx);
    const hMm = pxToMm(hPx);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    if (doc === null) {
      doc = new jsPDF({ unit: "mm", format: [wMm, hMm], hotfixes: ["px_scaling"] });
      doc.addImage(imgData, "JPEG", 0, 0, wMm, hMm);
    } else {
      doc.addPage([wMm, hMm]);
      doc.addImage(imgData, "JPEG", 0, 0, wMm, hMm);
    }
  }

  if (!doc) throw new Error("No pages captured");
  return doc.output("blob");
}
