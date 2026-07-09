/**
 * Client-side PDF export: one screenshot per editor page div, one PDF page per screenshot.
 * Uses html2canvas on each .preview-page element (full content, no clipping), then adds each
 * image as its own full page in the jsPDF document. No splitting of one long screenshot.
 * Optional link overlays add clickable URL areas (e.g. back cover website link) via pdf-lib post-process.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { PDFDocument, PDFName, PDFArray, PDFString } from "pdf-lib";

const CAPTURE_SCALE = 2;

/** Convert px to mm at 96dpi for jsPDF. */
function pxToMm(px: number): number {
  return (px / 96) * 25.4;
}

/** 1 mm in PDF points (1/72 inch). */
const MM_TO_PT = 72 / 25.4;

export type PdfLinkOverlay = {
  pageIndex: number;
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Wait for ALL images in the container to load (onload or onerror). Ensures background/cover images are ready before PDF capture. */
function waitForImages(container: HTMLElement, timeoutMs = 12000): Promise<void> {
  const imgs = container.querySelectorAll<HTMLImageElement>("img");
  if (imgs.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      Array.from(imgs).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth !== 0) {
              return resolve();
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    ).then(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Delay in ms after images load before capturing (allows full paint/render). */
const POST_LOAD_DELAY_MS = 1500;

/**
 * For PDF export: replace every img src that is not already a data URL with the base64 data URL
 * by fetching through the proxy (proxy returns data URL by default). Ensures html2canvas never
 * loads external URLs and gets clean bokeh/cover images.
 */
async function replaceImgSrcsWithDataUrls(container: HTMLElement): Promise<void> {
  const imgs = container.querySelectorAll<HTMLImageElement>("img");
  const promises: Promise<void>[] = [];
  for (const img of Array.from(imgs)) {
    const src = (img.getAttribute("src") ?? img.src ?? "").trim();
    if (!src || src.startsWith("data:")) continue;
    promises.push(
      fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`Fetch ${r.status}`))))
        .then((blob) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        })
        .then((dataUrl) => {
          img.src = dataUrl;
          img.setAttribute("src", dataUrl);
        })
        .catch(() => {})
    );
  }
  await Promise.all(promises);
}

/**
 * Add clickable link annotations to a PDF blob using pdf-lib.
 * overlayCoordsInMm: for each overlay, { pageIndex, url, xMm, yMm, wMm, hMm } (top-left origin).
 * pageHeightsMm: height in mm for each page (same index as pageIndex).
 */
async function addLinkAnnotationsToPdf(
  blob: Blob,
  overlayCoordsInMm: Array<{ pageIndex: number; url: string; xMm: number; yMm: number; wMm: number; hMm: number }>,
  pageHeightsMm: number[]
): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const pdfDoc = await PDFDocument.load(buf);
  const pages = pdfDoc.getPages();

  for (const o of overlayCoordsInMm) {
    if (o.pageIndex < 0 || o.pageIndex >= pages.length) continue;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url || !/^https?:\/\//i.test(url)) continue;

    const page = pages[o.pageIndex]!;
    const pageHeightMm = pageHeightsMm[o.pageIndex] ?? 0;
    // PDF Rect is [left, bottom, right, top] in user units (jsPDF writes in mm; pdf-lib preserves, but we use points to match typical PDF)
    const leftPt = o.xMm * MM_TO_PT;
    const bottomPt = (pageHeightMm - o.yMm - o.hMm) * MM_TO_PT;
    const rightPt = (o.xMm + o.wMm) * MM_TO_PT;
    const topPt = (pageHeightMm - o.yMm) * MM_TO_PT;
    const rect = [leftPt, bottomPt, rightPt, topPt];

    const linkDict = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(url),
      },
    });
    const linkRef = pdfDoc.context.register(linkDict);

    const annotsName = PDFName.of("Annots");
    const existing = page.node.lookup(annotsName);
    if (existing instanceof PDFArray) {
      const arr = existing.asArray().slice();
      arr.push(linkRef);
      page.node.set(annotsName, pdfDoc.context.obj(arr));
    } else {
      page.node.set(annotsName, pdfDoc.context.obj([linkRef]));
    }
  }

  const outBytes = await pdfDoc.save();
  return new Blob([outBytes], { type: "application/pdf" });
}

/**
 * Capture a container that has .preview-page children and return a PDF blob.
 * Each .preview-page is screenshot once in full (no width/height clamp); each screenshot
 * becomes exactly one PDF page. No splitting of a single screenshot across pages.
 * linkOverlays: optional list of { pageIndex, url, left, top, width, height } in CSS px
 * relative to each page top-left; adds clickable link annotations to the PDF.
 */
export async function captureCanvasPagesToPdf(
  container: HTMLElement,
  onProgress?: (page: number, total: number) => void,
  linkOverlays?: PdfLinkOverlay[]
): Promise<Blob> {
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".preview-page"));
  if (pages.length === 0) {
    throw new Error("No .preview-page elements found in container");
  }

  // Replace all img src with base64 data URLs via proxy so html2canvas never touches external URLs
  await replaceImgSrcsWithDataUrls(container);
  await waitForImages(container, 12000);
  await new Promise((r) => setTimeout(r, POST_LOAD_DELAY_MS));

  let doc: jsPDF | null = null;
  const pageHeightsMm: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i + 1, pages.length);
    const pageEl = pages[i]!;

    await Promise.all(
      Array.from(pageEl.querySelectorAll('img')).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(resolve => {
              img.onload = resolve
              img.onerror = resolve
            })
      )
    )
    await new Promise(resolve => setTimeout(resolve, 500))

    // Screenshot this page div in full — no width/height so the entire element is captured
    const canvas = await html2canvas(pageEl, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      backgroundColor: null,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const covers = clonedDoc.querySelectorAll('[class*="cover"]')
        covers.forEach(el => {
          (el as HTMLElement).style.transform = 'none';
          (el as HTMLElement).style.opacity = '1';
          (el as HTMLElement).style.visibility = 'visible';
        })
      }
    });

    const wPx = canvas.width / CAPTURE_SCALE;
    const hPx = canvas.height / CAPTURE_SCALE;
    const wMm = pxToMm(wPx);
    const hMm = pxToMm(hPx);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    pageHeightsMm.push(hMm);

    if (doc === null) {
      doc = new jsPDF({ unit: "mm", format: [wMm, hMm], hotfixes: ["px_scaling"] });
      doc.addImage(imgData, "JPEG", 0, 0, wMm, hMm);
    } else {
      doc.addPage([wMm, hMm]);
      doc.addImage(imgData, "JPEG", 0, 0, wMm, hMm);
    }
  }

  if (!doc) throw new Error("No pages captured");
  let blob = doc.output("blob");

  // Add clickable link annotations via pdf-lib (jsPDF ESM build may not include link())
  if (linkOverlays && linkOverlays.length > 0 && pageHeightsMm.length > 0) {
    const overlayCoordsInMm = linkOverlays
      .filter((o) => o.pageIndex >= 0 && o.pageIndex < pageHeightsMm.length)
      .map((o) => ({
        pageIndex: o.pageIndex,
        url: o.url,
        xMm: pxToMm(o.left),
        yMm: pxToMm(o.top),
        wMm: pxToMm(o.width),
        hMm: pxToMm(o.height),
      }))
      .filter((o) => /^https?:\/\//i.test(typeof o.url === "string" ? o.url.trim() : ""));
    if (overlayCoordsInMm.length > 0) {
      try {
        blob = await addLinkAnnotationsToPdf(blob, overlayCoordsInMm, pageHeightsMm);
      } catch (e) {
        console.warn("[pdf-client-export] Link annotation post-process failed:", e);
      }
    }
  }

  return blob;
}
