/**
 * Shortens a title to a punchy 3-4 word thumbnail hook.
 * Keeps natural phrasing by anchoring on ALL-CAPS words and numbers,
 * then bridging them with connecting words.
 *
 * Examples:
 *   "What WEALTH Looks Like at 3AM: The Untold Truth"  → "WEALTH AT 3AM"
 *   "Why Rich People Wake Up at 5AM"                   → "UP AT 5AM"
 *   "How I Made $1 Million in 30 Days"                 → "$1 IN 30 DAYS"
 *   "The Secret Habits of Billionaires"                → "SECRET HABITS OF BILLIONAIRES"
 */
export function makeThumbnailHook(title: string): string {
  // Strip subtitle after colon or dash
  const main = title.split(/[:\-–—]/)[0].trim();
  const words = main.split(/\s+/).filter(Boolean);

  if (words.length <= 4) return main.toUpperCase();

  // Find "anchor" words: intentionally ALL-CAPS or contain digits/$/%
  const anchorIdx: number[] = [];
  words.forEach((w, i) => {
    const isAllCaps = w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
    const isSpecial = /[\d$%]/.test(w);
    if (isAllCaps || isSpecial) anchorIdx.push(i);
  });

  if (anchorIdx.length >= 2) {
    const first = anchorIdx[0];
    const last = anchorIdx[anchorIdx.length - 1];
    // first anchor + bridge word (word immediately before last anchor) + last anchor
    const chosen: string[] = [words[first]];
    if (last - first >= 2) chosen.push(words[last - 1]); // e.g. "at"
    chosen.push(words[last]);
    // optionally append the word right after the last anchor (e.g. "Days")
    if (chosen.length < 4 && last + 1 < words.length) chosen.push(words[last + 1]);
    return chosen.join(" ").toUpperCase();
  }

  if (anchorIdx.length === 1) {
    // Single anchor: take up to 2 words before it + the anchor + 1 after
    const idx = anchorIdx[0];
    const start = Math.max(0, idx - 2);
    return words.slice(start, Math.min(words.length, start + 4)).join(" ").toUpperCase();
  }

  // No anchors — take first 4 words, skipping a leading article
  const skipFirst = new Set(["the", "a", "an"]);
  const start = skipFirst.has(words[0].toLowerCase()) ? 1 : 0;
  return words.slice(start, start + 4).join(" ").toUpperCase();
}

/**
 * Composites bold title text onto a thumbnail image using the browser Canvas API.
 * Uses a short punchy hook (3-4 words) so text is always fully visible.
 * Returns a base64 data URL (PNG) ready to upload or display.
 *
 * Fetches the image via our /api/proxy-thumbnail endpoint first (server-side fetch,
 * no CORS headers required), then converts to a blob URL so canvas.toDataURL()
 * never throws a SecurityError.
 */
export async function addTextOverlayToThumbnail(
  imageUrl: string,
  title: string,
): Promise<string> {
  // ── Step 1: get the image bytes without CORS restrictions ──────────────────
  // External URLs are routed through our own proxy so the browser never hits a
  // cross-origin CDN directly.  Blob URLs and data URLs are already same-origin.
  let blobSrc: string;

  if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    // Already local — use as-is
    blobSrc = imageUrl;
  } else {
    const proxyUrl = `/api/proxy-thumbnail?url=${encodeURIComponent(imageUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error(`Could not fetch thumbnail (proxy ${res.status})`);
    }
    const blob = await res.blob();
    blobSrc = URL.createObjectURL(blob);
  }

  // ── Step 2: draw the image + text on a canvas ─────────────────────────────
  return new Promise((resolve, reject) => {
    const img = new Image();
    // crossOrigin is intentionally NOT set — blob URLs are same-origin, no CORS needed

    img.onload = () => {
      // Clean up the temporary blob URL
      if (blobSrc.startsWith("blob:")) URL.revokeObjectURL(blobSrc);

      const W = img.naturalWidth || 1280;
      const H = img.naturalHeight || 720;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      // Draw background image
      ctx.drawImage(img, 0, 0, W, H);

      // Dark gradient over bottom half
      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── Text ──
      const hook = makeThumbnailHook(title);

      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      // Auto-size font so text fills ~85% of width in one line
      let fontSize = Math.round(W / 6);
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
      while (ctx.measureText(hook).width > W * 0.88 && fontSize > 40) {
        fontSize -= 4;
        ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
      }

      const y = H - H * 0.07;

      // Black stroke for contrast
      ctx.strokeStyle = "rgba(0,0,0,0.95)";
      ctx.lineWidth = fontSize * 0.1;
      ctx.lineJoin = "round";
      ctx.strokeText(hook, W / 2, y);

      // White fill
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(hook, W / 2, y);

      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      if (blobSrc.startsWith("blob:")) URL.revokeObjectURL(blobSrc);
      reject(new Error("Failed to load thumbnail image"));
    };

    img.src = blobSrc;
  });
}
