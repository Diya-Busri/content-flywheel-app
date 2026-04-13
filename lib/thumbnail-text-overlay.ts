/**
 * Shortens a title to a punchy 3-5 word thumbnail hook.
 * e.g. "What WEALTH Looks Like at 3AM: The Untold Truth Revealed"
 *   → "The WEALTH Truth"
 */
function makeThumbnailHook(title: string): string {
  // Strip everything after a colon or dash (subtitle)
  const main = title.split(/[:\-–—]/)[0].trim();
  const words = main.split(" ").filter(Boolean);

  // If already 4 words or fewer, use as-is
  if (words.length <= 4) return main.toUpperCase();

  // Pick the most impactful words: capitalised/short words tend to be keywords
  // Strategy: take first word + any ALL-CAPS or long "power" words + last word, max 4
  const stop = new Set(["the","a","an","to","of","in","on","at","for","and","or","but","is","are","was","were","be","been","has","have","had","do","does","did","will","would","could","should","may","might","like","with","from","that","this","it","its","by","as","up","out","if","so","not","no","we","you","your","my","our","their","them","they","he","she","what","how","why","when","where","who","which","than","then","also","about"]);
  const power = words.filter(w => !stop.has(w.toLowerCase()));

  // Take up to 4 power words
  const chosen = power.slice(0, 4);
  return chosen.join(" ").toUpperCase();
}

/**
 * Composites bold title text onto a thumbnail image using the browser Canvas API.
 * Uses a short punchy hook (3-4 words) so text is always fully visible.
 * Returns a base64 data URL (PNG) ready to upload or display.
 */
export async function addTextOverlayToThumbnail(
  imageUrl: string,
  title: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const W = img.naturalWidth || 1792;
      const H = img.naturalHeight || 1024;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      // Draw background image
      ctx.drawImage(img, 0, 0, W, H);

      // Dark gradient over bottom 45%
      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── Shorten title to 3-4 punchy words ──
      const hook = makeThumbnailHook(title);

      // ── Text setup — big enough to fill width with only 4 words ──
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      // Auto-size font so text fills ~85% of width in one line
      let fontSize = Math.round(W / 6);
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
      while (ctx.measureText(hook).width > W * 0.88 && fontSize > 60) {
        fontSize -= 4;
        ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
      }

      const bottomPad = H * 0.07;
      const y = H - bottomPad;

      // Black stroke for contrast
      ctx.strokeStyle = "rgba(0,0,0,0.95)";
      ctx.lineWidth = fontSize * 0.1;
      ctx.lineJoin = "round";
      ctx.strokeText(hook, W / 2, y);

      // White fill
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(hook, W / 2, y);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      reject(new Error("Image blocked by CORS — cannot add text overlay"));
    };

    img.src = imageUrl;
  });
}
