/**
 * Burned-in captions for FFmpeg drawtext: viral AI-story style (yellow speaker, white line, black outline, bottom center).
 * Used by server compile (lib/videos/compile) and client wasm export (video-timeline page).
 */

export const VIRAL_CAPTION_FONT_SIZES = { small: 24, medium: 26, large: 28 } as const;
export const VIRAL_CAPTION_BOTTOM_PAD = 24;

/**
 * Escape text embedded in FFmpeg filter drawtext=text='...'.
 * Commas MUST be \, or the filtergraph splits options and dialogue after the first comma disappears.
 */
/** TrueType collections (.ttc) need an explicit face index for drawtext on many FFmpeg builds. */
function buildDrawtextFontfileFilterOpt(fontFile: string): string {
  const p = fontFile.trim().replace(/\\/g, "/");
  const safe = p
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/%/g, "\\%")
    .replace(/ /g, "\\ ");
  const ttc = /\.ttc$/i.test(p) ? ":fontindex=0" : "";
  return `:fontfile=${safe}${ttc}`;
}

export function escapeDrawtextForFfmpeg(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    // We quote drawtext text with double quotes, so escape " instead of apostrophe.
    .replace(/"/g, '\\"')
    .replace(/,/g, "\\,")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

/** Split "Speaker: dialogue" on first colon. */
export function splitDialogueLine(line: string): { speaker: string; dialogue: string } | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;
  const speaker = line.slice(0, idx).trim();
  const dialogue = line.slice(idx + 1).trim();
  if (!speaker) return null;
  return { speaker, dialogue };
}

export function estimateTextWidthPx(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    w += code > 127 ? fontSize * 0.95 : fontSize * 0.52;
  }
  return Math.ceil(w);
}

export function measureTextWidthCanvas(text: string, fontSize: number): number | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    /** Match FFmpeg drawtext default (sans, not bold) so x2 aligns with rendered yellow prefix */
    ctx.font = `${fontSize}px sans-serif`;
    return ctx.measureText(text).width;
  } catch {
    return null;
  }
}

export function getTextWidthPx(text: string, fontSize: number): number {
  return measureTextWidthCanvas(text, fontSize) ?? estimateTextWidthPx(text, fontSize);
}

export type ViralCaptionDrawtextOpts = {
  videoWidth: number;
  dialogueLine: string;
  /** Absolute font file path for FFmpeg drawtext (server-side). Optional for environments with fontconfig. */
  fontFile?: string;
  fontSize?: number;
  /** Default bottom padding when yExpr not set. */
  bottomPadPx?: number;
  /** Override vertical position (e.g. animated y). Default: h-text_h-bottomPad */
  yExpr?: string;
  /** If set, both drawtext filters get enable='...' (timeline export). */
  enableExpr?: string;
  /** Optional alpha expression (both layers). */
  alphaExpr?: string;
  /** Deterministic label for intermediate stream (filter_complex). */
  midLabel?: string;
  /** Minimum font size when shrinking to fit width (default 18). */
  minFontSize?: number;
  /** Horizontal margin from video edges (default 12). */
  horizontalMargin?: number;
};

/**
 * filter_complex fragment: [fromLabel] ... [toLabel] — viral dual-color or single-line captions.
 */
export function buildViralCaptionDrawtextChain(
  fromLabel: string,
  toLabel: string,
  opts: ViralCaptionDrawtextOpts
): string {
  const line = opts.dialogueLine.replace(/\r?\n/g, " ").trim();
  const fontSize = opts.fontSize ?? VIRAL_CAPTION_FONT_SIZES.medium;
  const bottomPad = opts.bottomPadPx ?? VIRAL_CAPTION_BOTTOM_PAD;
  const y = opts.yExpr ?? `h-text_h-${bottomPad}`;
  const enable = opts.enableExpr?.trim();
  const enableOpt = enable ? `:enable='${enable}'` : "";
  const alphaOpt =
    opts.alphaExpr != null && String(opts.alphaExpr).trim() !== "" ? `:alpha='${opts.alphaExpr}'` : "";
  // FFmpeg drawtext is sensitive to quoting for fontfile; pass it unquoted.
  const fontOpt =
    opts.fontFile && opts.fontFile.trim() ? buildDrawtextFontfileFilterOpt(opts.fontFile) : "";

  if (!line) {
    throw new Error("buildViralCaptionDrawtextChain: empty dialogueLine");
  }

  const split = splitDialogueLine(line);
  if (!split) {
    const t = escapeDrawtextForFfmpeg(line);
    return `[${fromLabel}]drawtext=text="${t}"${fontOpt}:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${y}${enableOpt}${alphaOpt}[${toLabel}]`;
  }

  /** Two drawtext filters with empty body break some FFmpeg builds (no output pad). */
  if (!split.dialogue.trim()) {
    const t = escapeDrawtextForFfmpeg(line);
    return `[${fromLabel}]drawtext=text="${t}"${fontOpt}:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${y}${enableOpt}${alphaOpt}[${toLabel}]`;
  }

  const nameP = `${split.speaker}: `;
  const bodyP = split.dialogue;
  const margin = opts.horizontalMargin ?? 12;
  const minFs = opts.minFontSize ?? 18;
  const maxW = Math.max(32, opts.videoWidth - 2 * margin);

  let fs = fontSize;
  let w1 = getTextWidthPx(nameP, fs);
  let w2 = getTextWidthPx(bodyP, fs);
  while (fs > minFs && w1 + w2 > maxW) {
    fs -= 1;
    w1 = getTextWidthPx(nameP, fs);
    w2 = getTextWidthPx(bodyP, fs);
  }

  /** If still too wide, fall back to one centered white line (full dialogue; avoids clipping). */
  if (w1 + w2 > maxW) {
    const t = escapeDrawtextForFfmpeg(line);
    return `[${fromLabel}]drawtext=text="${t}"${fontOpt}:fontsize=${minFs}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${y}${enableOpt}${alphaOpt}[${toLabel}]`;
  }

  const total = w1 + w2;
  const x1 = Math.max(margin, Math.round((opts.videoWidth - total) / 2));
  const x2 = Math.round(x1 + w1);
  const e1 = escapeDrawtextForFfmpeg(nameP);
  const e2 = escapeDrawtextForFfmpeg(bodyP);
  const mid = opts.midLabel ?? "vcapmid";
  return (
    `[${fromLabel}]drawtext=text="${e1}"${fontOpt}:fontsize=${fs}:fontcolor=yellow:borderw=2:bordercolor=black:x=${x1}:y=${y}${enableOpt}${alphaOpt}[${mid}];` +
    `[${mid}]drawtext=text="${e2}"${fontOpt}:fontsize=${fs}:fontcolor=white:borderw=2:bordercolor=black:x=${x2}:y=${y}${enableOpt}${alphaOpt}[${toLabel}]`
  );
}

/**
 * Comma-separated drawtext chain for -vf (no stream labels). Use after scale/pad on video segments.
 */
export function buildViralCaptionDrawtextFlatVf(
  dialogueLine: string,
  videoWidth: number,
  fontSize: number,
  fontFile?: string
): string {
  const line = dialogueLine.replace(/\r?\n/g, " ").trim();
  if (!line) return "";
  const y = `h-text_h-${VIRAL_CAPTION_BOTTOM_PAD}`;
  const margin = 12;
  const minFs = 18;
  const maxW = Math.max(32, videoWidth - 2 * margin);
  // FFmpeg drawtext is sensitive to quoting for fontfile; pass it unquoted.
  const fontOpt = fontFile && fontFile.trim() ? buildDrawtextFontfileFilterOpt(fontFile) : "";
  const split = splitDialogueLine(line);
  if (!split) {
    const t = escapeDrawtextForFfmpeg(line);
    return `drawtext=text="${t}"${fontOpt}:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${y}`;
  }
  if (!split.dialogue.trim()) {
    const t = escapeDrawtextForFfmpeg(line);
    return `drawtext=text="${t}"${fontOpt}:fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${y}`;
  }
  const nameP = `${split.speaker}: `;
  const bodyP = split.dialogue;
  let fs = fontSize;
  let w1 = getTextWidthPx(nameP, fs);
  let w2 = getTextWidthPx(bodyP, fs);
  while (fs > minFs && w1 + w2 > maxW) {
    fs -= 1;
    w1 = getTextWidthPx(nameP, fs);
    w2 = getTextWidthPx(bodyP, fs);
  }
  if (w1 + w2 > maxW) {
    const t = escapeDrawtextForFfmpeg(line);
    return `drawtext=text="${t}"${fontOpt}:fontsize=${minFs}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${y}`;
  }
  const total = w1 + w2;
  const x1 = Math.max(margin, Math.round((videoWidth - total) / 2));
  const x2 = Math.round(x1 + w1);
  const e1 = escapeDrawtextForFfmpeg(nameP);
  const e2 = escapeDrawtextForFfmpeg(bodyP);
  return `drawtext=text="${e1}"${fontOpt}:fontsize=${fs}:fontcolor=yellow:borderw=2:bordercolor=black:x=${x1}:y=${y},drawtext=text="${e2}"${fontOpt}:fontsize=${fs}:fontcolor=white:borderw=2:bordercolor=black:x=${x2}:y=${y}`;
}
