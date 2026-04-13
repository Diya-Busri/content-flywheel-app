/**
 * Composites bold title text onto a thumbnail image using the browser Canvas API.
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

      // Dark gradient over bottom 40%
      const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── Text setup ──
      const maxWidth = W * 0.88;
      const fontSize = Math.round(W / 12); // ~150px at 1792w
      ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      // Word-wrap title into lines
      const words = title.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);

      const lineH = fontSize * 1.2;
      const totalH = lines.length * lineH;
      const bottomPad = H * 0.06;
      const startY = H - bottomPad - (lines.length - 1) * lineH;

      lines.forEach((line, i) => {
        const y = startY + i * lineH;
        // Black stroke for contrast
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.lineWidth = fontSize * 0.08;
        ctx.lineJoin = "round";
        ctx.strokeText(line, W / 2, y);
        // White fill
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(line, W / 2, y);
      });

      // Subtle channel-brand strip at very top
      ctx.fillStyle = "rgba(255,80,0,0.85)"; // orange brand accent
      ctx.fillRect(0, 0, W * 0.007, H); // thin left bar

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      // CORS fallback: try without crossOrigin
      const img2 = new Image();
      img2.onload = () => {
        // Re-run without tainted check — note: toDataURL will fail if tainted
        // so we just reject and let caller handle
        reject(new Error("Image blocked by CORS — cannot add text overlay"));
      };
      img2.onerror = () => reject(new Error("Image failed to load"));
      img2.src = imageUrl;
    };

    img.src = imageUrl;
  });
}
