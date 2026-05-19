import { DesignData, DesignElement } from "@/db/schema/designs-schema";

export type ContentRow = {
  id: string;
  hook: string;
  mainText: string;
  cta: string;
  bgTheme: string;
  productTitle?: string;
};

export type TemplateStyle =
  | "minimal-luxury" | "dark-aesthetic" | "wellness"
  | "clean-productivity" | "faceless-creator" | "modern-business";

// ── Seeded deterministic RNG ───────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── Slide role: carousel narrative flow ───────────────────────────────────────

type SlideRole = "hook" | "supporting" | "tip" | "emotional" | "cta";

function getSlideRole(index: number, total: number): SlideRole {
  if (total <= 1) return "hook";
  if (index === 0) return "hook";
  if (index === total - 1) return "cta";
  if (index === total - 2 && total > 3) return "emotional";
  return index / (total - 1) < 0.5 ? "supporting" : "tip";
}

// ── Hook content analysis ──────────────────────────────────────────────────────

const POWER_WORDS = new Set([
  "STOP","START","NOW","FREE","SECRET","PROVEN","NEVER","ALWAYS","EVERY",
  "ONLY","MUST","KEY","BOOST","UNLOCK","MASTER","TRANSFORM","SIMPLE","FAST",
  "HACK","TRUTH","REAL","WHY","HOW","WHAT","WRONG","RIGHT","BEST","WORST",
  "NEW","WAKE","QUIT","DO","THIS","YOU","YOUR",
]);

type HookAnalysis = {
  wordCount: number;
  words: string[];
  isQuestion: boolean;
  intensity: "low" | "medium" | "high";
  lengthClass: "short" | "medium" | "long";
};

function analyzeHook(hook: string): HookAnalysis {
  const words = hook.trim().split(/\s+/);
  const wordCount = words.length;
  const isQuestion = hook.includes("?");
  const hasExclamation = hook.includes("!");
  const uppercaseRatio =
    (hook.replace(/[^A-Za-z]/g, "").match(/[A-Z]/g)?.length ?? 0) /
    Math.max(hook.replace(/[^a-zA-Z]/g, "").length, 1);
  const hasPower = words.slice(0, 5).some((w) =>
    POWER_WORDS.has(w.replace(/[^A-Z]/g, "").toUpperCase())
  );

  let intensity: HookAnalysis["intensity"] = "medium";
  if (hasExclamation || uppercaseRatio > 0.5 || hasPower) intensity = "high";
  else if (isQuestion || wordCount <= 5) intensity = "medium";
  else intensity = "low";

  return {
    wordCount,
    words,
    isQuestion,
    intensity,
    lengthClass: wordCount <= 5 ? "short" : wordCount <= 10 ? "medium" : "long",
  };
}

// ── Style configs ──────────────────────────────────────────────────────────────

type StyleCfg = {
  headingColor: string; bodyColor: string; accentColor: string;
  hookFont: string; bodyFont: string;
};

export const TEMPLATE_CONFIGS: Record<TemplateStyle, StyleCfg> = {
  "minimal-luxury":    { headingColor: "#1A1A1A", bodyColor: "#4A4A4A", accentColor: "#C9A84C", hookFont: "Playfair Display", bodyFont: "Georgia" },
  "dark-aesthetic":    { headingColor: "#FFFFFF",  bodyColor: "#CCCCCC", accentColor: "#FF6B35", hookFont: "Oswald",           bodyFont: "Inter" },
  "wellness":          { headingColor: "#2D5016",  bodyColor: "#3D6B2A", accentColor: "#5C9A3E", hookFont: "Playfair Display", bodyFont: "Georgia" },
  "clean-productivity":{ headingColor: "#1E3A5F",  bodyColor: "#374151", accentColor: "#3B82F6", hookFont: "Inter",            bodyFont: "Inter" },
  "faceless-creator":  { headingColor: "#FFFFFF",  bodyColor: "#B0B8D0", accentColor: "#E94560", hookFont: "Oswald",           bodyFont: "Inter" },
  "modern-business":   { headingColor: "#FFFFFF",  bodyColor: "#CBD5E1", accentColor: "#F59E0B", hookFont: "Oswald",           bodyFont: "Inter" },
};

// ── Background variants ────────────────────────────────────────────────────────

type BgVariant = Pick<DesignData, "background" | "backgroundType" | "backgroundGradient">;

const STYLE_BACKGROUNDS: Record<TemplateStyle, BgVariant[]> = {
  "minimal-luxury": [
    { background: "#FAFAF7", backgroundType: "solid" },
    { background: "#F5F3EE", backgroundType: "gradient", backgroundGradient: { color1: "#F5F3EE", color2: "#EEEBE3", angle: 145 } },
    { background: "#FDFCF8", backgroundType: "solid" },
    { background: "#F8F6F0", backgroundType: "gradient", backgroundGradient: { color1: "#F8F6F0", color2: "#EDE9DC", angle: 160 } },
  ],
  "dark-aesthetic": [
    { background: "#0D0D0D", backgroundType: "solid" },
    { background: "#111111", backgroundType: "gradient", backgroundGradient: { color1: "#111111", color2: "#1A1A1A", angle: 160 } },
    { background: "#0A0A0A", backgroundType: "gradient", backgroundGradient: { color1: "#0A0A0A", color2: "#151515", angle: 135 } },
    { background: "#121212", backgroundType: "solid" },
  ],
  "wellness": [
    { background: "#E8F0E8", backgroundType: "gradient", backgroundGradient: { color1: "#E8F0E8", color2: "#C5DBC5", angle: 160 } },
    { background: "#EBF2EB", backgroundType: "gradient", backgroundGradient: { color1: "#EBF2EB", color2: "#CCDECA", angle: 145 } },
    { background: "#E5EFEA", backgroundType: "gradient", backgroundGradient: { color1: "#E5EFEA", color2: "#C8DDCC", angle: 170 } },
    { background: "#EDF3EE", backgroundType: "gradient", backgroundGradient: { color1: "#EDF3EE", color2: "#D0DFD0", angle: 150 } },
  ],
  "clean-productivity": [
    { background: "#FFFFFF", backgroundType: "solid" },
    { background: "#F8FAFF", backgroundType: "gradient", backgroundGradient: { color1: "#F8FAFF", color2: "#EEF4FF", angle: 150 } },
    { background: "#FAFCFF", backgroundType: "solid" },
    { background: "#F5F8FF", backgroundType: "gradient", backgroundGradient: { color1: "#F5F8FF", color2: "#E8EFFE", angle: 140 } },
  ],
  "faceless-creator": [
    { background: "#1a1a2e", backgroundType: "gradient", backgroundGradient: { color1: "#1a1a2e", color2: "#16213e", angle: 135 } },
    { background: "#1b1a30", backgroundType: "gradient", backgroundGradient: { color1: "#1b1a30", color2: "#0f1933", angle: 150 } },
    { background: "#191928", backgroundType: "gradient", backgroundGradient: { color1: "#191928", color2: "#15203a", angle: 125 } },
    { background: "#1c1b32", backgroundType: "gradient", backgroundGradient: { color1: "#1c1b32", color2: "#161f3c", angle: 140 } },
  ],
  "modern-business": [
    { background: "#1E3A5F", backgroundType: "solid" },
    { background: "#1A3558", backgroundType: "gradient", backgroundGradient: { color1: "#1A3558", color2: "#152d4f", angle: 155 } },
    { background: "#1F3C63", backgroundType: "solid" },
    { background: "#1C3860", backgroundType: "gradient", backgroundGradient: { color1: "#1C3860", color2: "#162f52", angle: 145 } },
  ],
};

// ── Element helpers ────────────────────────────────────────────────────────────

function txt(
  id: string, content: string,
  x: number, y: number, w: number, h: number,
  opts: Partial<DesignElement> = {},
): DesignElement {
  return { id, type: "text", x, y, width: w, height: h, content, zIndex: 2, ...opts };
}

function rect(
  id: string,
  x: number, y: number, w: number, h: number,
  fill: string,
  opts: Partial<DesignElement> = {},
): DesignElement {
  return { id, type: "shape", x, y, width: w, height: h, fill, zIndex: 1, shapeType: "rect", ...opts };
}

// Rough hook height estimate for layout math
function hookBlockHeight(fs: number, wordCount: number, lineW: number): number {
  const charsPerLine = Math.floor(lineW / (fs * 0.55));
  const totalChars = wordCount * 6;
  const lines = Math.max(Math.ceil(totalChars / charsPerLine), 1);
  return Math.max(lines * fs * 1.15, fs * 2.2);
}

// Body font size — smaller when mainText is long
function bodyFontSize(mainText: string): number {
  const wc = mainText.trim().split(/\s+/).length;
  return wc > 45 ? 36 : wc > 30 ? 40 : 44;
}

// ── 8 Layout Personalities ─────────────────────────────────────────────────────

// 1. HERO STATEMENT ─ Massive hook. Everything else whispers. Emotional impact.
function buildHeroStatement(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 175 : analysis.lengthClass === "medium" ? 142 : 112;
  const bodyFs = bodyFontSize(post.mainText) - 6;
  const hookW = W - 80;
  const hookX = 40;
  const hookY = 220;
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const bodyY = hookY + hH + 90;
  const sub = rng();

  const elements: DesignElement[] = [
    // Grace-note line above hook
    rect("grace-line", W / 2 - 50, hookY - 56, 100, 3, cfg.accentColor, { borderRadius: 2 }),
    // Giant hook
    txt("hook", post.hook, hookX, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "center", lineHeight: 0.92,
      letterSpacing: analysis.lengthClass === "short" ? -3 : -1,
    }),
    // Whisper body
    txt("body", post.mainText, W / 2 - 270, bodyY, 540, 380, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "center", lineHeight: 1.55, opacity: 0.65,
    }),
    // Tiny subtle CTA
    txt("cta", post.cta, W / 2 - 300, H - 220, 600, 100, {
      fontSize: 32, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "center", letterSpacing: 1,
    }),
  ];

  // Sub-variant: diagonal accent rect in corner
  if (sub > 0.5) {
    elements.push(rect("corner-accent", W - 100, 100, 60, 8, cfg.accentColor, {
      rotation: 45, opacity: 0.6, zIndex: 0, borderRadius: 4,
    }));
    elements.push(rect("corner-accent2", W - 80, 130, 60, 8, cfg.accentColor, {
      rotation: 45, opacity: 0.3, zIndex: 0, borderRadius: 4,
    }));
  }

  return elements;
}

// 2. EDITORIAL ─ Left-aligned. Asymmetric. Magazine composition.
function buildEditorial(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 102 : analysis.lengthClass === "medium" ? 84 : 68;
  const bodyFs = bodyFontSize(post.mainText);
  const leftX = 120;
  const hookW = W - 200;
  const hookY = 260 + Math.round(rng() * 60);
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const ruleY = hookY + hH + 50;
  const bodyY = ruleY + 52;
  const bodyW = W - 300; // narrower than hook — intentionally asymmetric
  const sub = rng();

  const elements: DesignElement[] = [
    // Vertical accent bar runs alongside hook
    rect("v-bar", leftX - 32, hookY - 30, 5, hH + 60, cfg.accentColor, { borderRadius: 3 }),
    // Small label above hook
    txt("label", "—", leftX, hookY - 48, 80, 44, {
      fontSize: 28, fontFamily: cfg.bodyFont, color: cfg.accentColor, opacity: 0.8,
    }),
    // Hook: left-aligned
    txt("hook", post.hook, leftX, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "left", lineHeight: 1.08,
    }),
    // Horizontal rule separates hook from body
    rect("h-rule", leftX, ruleY, W - 240, 2, cfg.accentColor, { opacity: 0.35 }),
    // Body: left-aligned, narrower than hook
    txt("body", post.mainText, leftX, bodyY, bodyW, 560, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "left", lineHeight: 1.55,
    }),
  ];

  // CTA: arrow-style left-aligned OR right-corner variant
  if (sub < 0.6) {
    elements.push(txt("cta", "→  " + post.cta, leftX, H - 260, bodyW, 120, {
      fontSize: 36, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "left",
    }));
  } else {
    // Right-aligned CTA for asymmetric contrast
    elements.push(txt("cta", post.cta + "  →", 200, H - 260, W - 280, 120, {
      fontSize: 36, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "right",
    }));
    elements.push(rect("cta-line", W - 260, H - 280, 160, 2, cfg.accentColor, { opacity: 0.4 }));
  }

  return elements;
}

// 3. QUOTE FOCUS ─ One dominant statement. Giant decorative mark. Everything whispers.
function buildQuoteFocus(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 108 : analysis.lengthClass === "medium" ? 90 : 74;
  const bodyFs = bodyFontSize(post.mainText) - 6;
  const hookW = W - 200;
  const hookX = (W - hookW) / 2;
  const hookY = 440 + Math.round(rng() * 60);
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const sub = rng();

  const elements: DesignElement[] = [
    // Massive decorative quote mark — the visual anchor
    txt("quote-open", "“", 60, 220, 240, 280, {
      fontSize: 320, fontFamily: cfg.hookFont, color: cfg.accentColor,
      opacity: 0.13, lineHeight: 1, fontWeight: "bold", zIndex: 0,
    }),
    // Hook: italic, slightly narrower, centered — reads as the actual quote
    txt("hook", post.hook, hookX, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontStyle: "italic", textAlign: "center", lineHeight: 1.22,
    }),
    // Em-dash separator below
    rect("em-dash", W / 2 - 40, hookY + hH + 50, 80, 2, cfg.accentColor, { opacity: 0.5 }),
    // Very small body — attribution style
    txt("body", post.mainText, W / 2 - 260, hookY + hH + 90, 520, 400, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "center", lineHeight: 1.6, opacity: 0.7,
    }),
    // Tiny CTA
    txt("cta", post.cta, W / 2 - 260, H - 230, 520, 100, {
      fontSize: 30, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "center",
    }),
  ];

  // Closing quote mark mirrored at bottom-right
  if (sub > 0.45) {
    elements.push(txt("quote-close", "”", W - 200, H - 500, 200, 240, {
      fontSize: 280, fontFamily: cfg.hookFont, color: cfg.accentColor,
      opacity: 0.08, lineHeight: 1, fontWeight: "bold", zIndex: 0,
    }));
  }

  return elements;
}

// 4. SPLIT COMPOSITION ─ Two visual zones divided by a prominent bar.
function buildSplitComposition(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 100 : analysis.lengthClass === "medium" ? 82 : 66;
  const bodyFs = bodyFontSize(post.mainText);
  const topZoneH = Math.round(H * 0.46);
  const dividerH = 14;
  const dividerY = topZoneH;
  const bottomZoneY = dividerY + dividerH + 40;
  const hookY = 180 + Math.round(rng() * 60);
  const hookW = W - 120;
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const sub = rng();

  const elements: DesignElement[] = [
    // TOP ZONE: Hook centered
    txt("hook", post.hook, 60, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "center", lineHeight: 1.1,
    }),
    // DIVIDER BAR — visually dramatic, full-width
    rect("divider", 0, dividerY, W, dividerH, cfg.accentColor),
    // Thin accent bar offset below main divider for depth
    rect("divider-shadow", 0, dividerY + dividerH, W, 4, cfg.accentColor, { opacity: 0.25 }),
  ];

  if (sub < 0.5) {
    // Bottom zone: left-aligned body + CTA
    elements.push(txt("body", post.mainText, 120, bottomZoneY + 20, W - 240, 560, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "left", lineHeight: 1.55,
    }));
    elements.push(rect("cta-chip", 120, H - 320, W - 240, 110, cfg.accentColor + "1A", { borderRadius: 12 }));
    elements.push(txt("cta", post.cta, 140, H - 300, W - 280, 80, {
      fontSize: 38, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "left",
    }));
  } else {
    // Bottom zone: centered body + CTA
    elements.push(txt("body", post.mainText, 100, bottomZoneY + 20, W - 200, 560, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "center", lineHeight: 1.55,
    }));
    elements.push(rect("cta-block", 80, H - 310, W - 160, 120, cfg.accentColor, { borderRadius: 16 }));
    elements.push(txt("cta", post.cta, 100, H - 290, W - 200, 80, {
      fontSize: 40, fontFamily: cfg.bodyFont, color: "#FFFFFF",
      fontWeight: "bold", textAlign: "center",
    }));
  }

  return elements;
}

// 5. CTA PUNCH ─ The action is the star. Giant coloured CTA block dominates.
function buildCtaPunch(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 90 : analysis.lengthClass === "medium" ? 74 : 60;
  const bodyFs = bodyFontSize(post.mainText) - 4;
  const hookY = 160 + Math.round(rng() * 50);
  const hookW = W - 140;
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const bodyY = hookY + hH + 70;
  const ctaBlockY = H - 500;
  const ctaBlockH = 440;
  const sub = rng();

  const elements: DesignElement[] = [
    // Small accent line above hook
    rect("accent", W / 2 - 60, hookY - 50, 120, 4, cfg.accentColor, { borderRadius: 2 }),
    // Hook: smaller, leading to the CTA
    txt("hook", post.hook, 70, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "center", lineHeight: 1.1,
    }),
    // Body: compact, secondary
    txt("body", post.mainText, 140, bodyY, W - 280, 480, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "center", lineHeight: 1.5, opacity: 0.8,
    }),
    // Inverted-triangle pointer hint above CTA block
    rect("arrow-hint", W / 2 - 20, ctaBlockY - 36, 40, 30, cfg.accentColor, { opacity: 0.3 }),
    // GIANT CTA BLOCK
    rect("cta-block", 0, ctaBlockY, W, ctaBlockH, cfg.accentColor),
  ];

  if (sub < 0.55) {
    // CTA text centered in block, large
    elements.push(txt("cta", post.cta, 60, ctaBlockY + 130, W - 120, 200, {
      fontSize: 56, fontFamily: cfg.hookFont, color: "#FFFFFF",
      fontWeight: "bold", textAlign: "center", lineHeight: 1.1,
    }));
  } else {
    // Two-line treatment: action label small + main CTA large
    elements.push(txt("cta-label", "↓ Take action now", W / 2 - 240, ctaBlockY + 70, 480, 60, {
      fontSize: 26, fontFamily: cfg.bodyFont, color: "#FFFFFF", opacity: 0.7, textAlign: "center",
    }));
    elements.push(txt("cta", post.cta, 60, ctaBlockY + 150, W - 120, 220, {
      fontSize: 58, fontFamily: cfg.hookFont, color: "#FFFFFF",
      fontWeight: "bold", textAlign: "center", lineHeight: 1.05,
    }));
  }

  return elements;
}

// 6. MINIMAL LUXURY ─ Supreme negative space. Small, precise typography. Premium.
function buildMinimalLuxury(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 80 : analysis.lengthClass === "medium" ? 66 : 54;
  const bodyFs = bodyFontSize(post.mainText) - 8;
  // Hook sits in the middle third of the canvas — extreme whitespace above
  const hookW = 680;
  const hookX = (W - hookW) / 2;
  const hookY = 680 + Math.round(rng() * 80);
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const bodyY = hookY + hH + 100;
  const sub = rng();

  const elements: DesignElement[] = [
    // Single very thin top rule — the only decoration
    rect("top-rule", W / 2 - 55, hookY - 60, 110, 1, cfg.accentColor, { opacity: 0.5 }),
    // Hook: narrow, precise, elegant
    txt("hook", post.hook, hookX, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "center", lineHeight: 1.35, letterSpacing: 1,
    }),
    // Tiny body — very secondary
    txt("body", post.mainText, W / 2 - 250, bodyY, 500, 420, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "center", lineHeight: 1.65, opacity: 0.65,
    }),
    // Bottom rule
    rect("bottom-rule", W / 2 - 35, bodyY + 460, 70, 1, cfg.accentColor, { opacity: 0.3 }),
  ];

  if (sub < 0.5) {
    // Right-aligned CTA for editorial asymmetry
    elements.push(txt("cta", post.cta, 300, H - 220, W - 360, 100, {
      fontSize: 28, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "right", letterSpacing: 2,
    }));
  } else {
    // Centered, spaced-out CTA
    elements.push(txt("cta", post.cta, W / 2 - 260, H - 220, 520, 100, {
      fontSize: 28, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "center", letterSpacing: 3,
    }));
  }

  return elements;
}

// 7. AGGRESSIVE VIRAL ─ Staggered hook. Maximum energy. Left-anchored power.
function buildAggressiveViral(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  // Split hook: first chunk gets massive treatment, rest gets large but offset
  const words = analysis.words;
  const splitAt = words.length <= 3 ? words.length : Math.min(Math.ceil(words.length * 0.42), 4);
  const p1 = words.slice(0, splitAt).join(" ");
  const p2 = words.slice(splitAt).join(" ");

  const fs1: number = analysis.lengthClass === "short" ? 160 : analysis.lengthClass === "medium" ? 130 : 104;
  const fs2 = Math.round(fs1 * 0.68);
  const bodyFs = bodyFontSize(post.mainText);

  const p1W = W - 120;
  const p1X = 80;
  const p1Y = 180;
  const p1H = hookBlockHeight(fs1, splitAt, p1W);

  // p2 is offset to the right — staggered effect
  const p2X = p2 ? 200 : p1X;
  const p2Y = p1Y + p1H + 12;
  const p2W = W - 280;
  const p2H = p2 ? hookBlockHeight(fs2, words.length - splitAt, p2W) : 0;

  const bodyY = (p2 ? p2Y + p2H : p1Y + p1H) + 80;
  const sub = rng();

  const elements: DesignElement[] = [
    // Diagonal corner accent — energy marker
    rect("diag1", W - 140, 60, 80, 10, cfg.accentColor, { rotation: 45, opacity: 0.8, zIndex: 0 }),
    rect("diag2", W - 110, 90, 60, 10, cfg.accentColor, { rotation: 45, opacity: 0.4, zIndex: 0 }),
    // P1: giant, left-aligned
    txt("hook-p1", p1, p1X, p1Y, p1W, p1H, {
      fontSize: fs1, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "left", lineHeight: 0.95,
    }),
  ];

  // P2: indented, slightly smaller — staircase effect
  if (p2) {
    elements.push(txt("hook-p2", p2, p2X, p2Y, p2W, p2H, {
      fontSize: fs2, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "left", lineHeight: 0.98, opacity: 0.9,
    }));
  }

  // Body: left-aligned
  elements.push(txt("body", post.mainText, 100, bodyY, W - 200, 520, {
    fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
    textAlign: "left", lineHeight: 1.5,
  }));

  if (sub < 0.55) {
    // Partial-width accent CTA chip — left-anchored, NOT full width
    elements.push(rect("cta-bg", 80, H - 350, W - 240, 140, cfg.accentColor, { borderRadius: 12 }));
    elements.push(txt("cta", post.cta, 100, H - 330, W - 280, 100, {
      fontSize: 42, fontFamily: cfg.bodyFont, color: "#FFFFFF",
      fontWeight: "bold", textAlign: "left",
    }));
  } else {
    // Bold underline-style CTA
    elements.push(rect("cta-underline", 80, H - 280, 300, 4, cfg.accentColor, { borderRadius: 2 }));
    elements.push(txt("cta", post.cta, 80, H - 350, W - 200, 120, {
      fontSize: 44, fontFamily: cfg.hookFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "left",
    }));
  }

  return elements;
}

// 8. EDUCATIONAL ─ Structured. Readable. "Save this" formatting. Clear hierarchy.
const SAVE_TAGS = ["SAVE THIS", "PRO TIP", "KEY INSIGHT", "TAKE NOTE", "REMEMBER THIS", "MUST READ"];

function buildEducational(
  post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis,
  rng: () => number, W: number, H: number,
): DesignElement[] {
  const fs: number = analysis.lengthClass === "short" ? 92 : analysis.lengthClass === "medium" ? 78 : 64;
  const bodyFs = bodyFontSize(post.mainText);
  const leftX = 120;
  const hookW = W - 200;
  const tagLabel = SAVE_TAGS[Math.floor(rng() * SAVE_TAGS.length)];
  const tagY = 190;
  const tagH = 54;
  const hookY = tagY + tagH + 70;
  const hH = hookBlockHeight(fs, analysis.wordCount, hookW);
  const divY = hookY + hH + 44;
  const bodyY = divY + 48;
  const sub = rng();

  const elements: DesignElement[] = [
    // Tag chip at top-left — "SAVE THIS" style label
    rect("tag-bg", leftX, tagY, 220, tagH, cfg.accentColor + "20", { borderRadius: 8 }),
    rect("tag-left-bar", leftX, tagY, 4, tagH, cfg.accentColor, { borderRadius: 2 }),
    txt("tag-text", tagLabel, leftX + 16, tagY + 12, 196, tagH - 12, {
      fontSize: 20, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", letterSpacing: 2, textAlign: "left",
    }),
    // Hook: left-aligned, structured
    txt("hook", post.hook, leftX, hookY, hookW, hH, {
      fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor,
      fontWeight: "bold", textAlign: "left", lineHeight: 1.1,
    }),
    // Full-width separator rule — feels like a section break
    rect("section-rule", leftX, divY, W - 240, 2, cfg.accentColor, { opacity: 0.25 }),
    // Body: structured, left-aligned, readable
    txt("body", post.mainText, leftX, bodyY, W - 240, 580, {
      fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor,
      textAlign: "left", lineHeight: 1.6,
    }),
  ];

  if (sub < 0.5) {
    // "Follow for more" left-aligned CTA style
    elements.push(rect("cta-bar", leftX, H - 280, 4, 100, cfg.accentColor, { borderRadius: 2 }));
    elements.push(txt("cta", post.cta, leftX + 20, H - 285, W - 240, 110, {
      fontSize: 36, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "left",
    }));
  } else {
    // Numbered or chip-style CTA
    elements.push(rect("cta-chip", leftX, H - 290, W - 240, 110, cfg.accentColor + "15", { borderRadius: 12 }));
    elements.push(txt("cta", "→  " + post.cta, leftX + 20, H - 270, W - 280, 80, {
      fontSize: 36, fontFamily: cfg.bodyFont, color: cfg.accentColor,
      fontWeight: "bold", textAlign: "left",
    }));
  }

  return elements;
}

// ── Personality selection ──────────────────────────────────────────────────────

type PersonalityId =
  | "hero-statement" | "editorial" | "quote-focus" | "split-composition"
  | "cta-punch" | "minimal-luxury" | "aggressive-viral" | "educational";

const ROLE_POOLS: Record<SlideRole, [PersonalityId, number][]> = {
  hook: [
    ["hero-statement", 35], ["aggressive-viral", 30],
    ["quote-focus", 20], ["split-composition", 15],
  ],
  supporting: [
    ["editorial", 30], ["educational", 25],
    ["split-composition", 25], ["minimal-luxury", 20],
  ],
  tip: [
    ["educational", 40], ["editorial", 30],
    ["split-composition", 20], ["minimal-luxury", 10],
  ],
  emotional: [
    ["quote-focus", 35], ["hero-statement", 25],
    ["minimal-luxury", 25], ["editorial", 15],
  ],
  cta: [
    ["cta-punch", 50], ["hero-statement", 20],
    ["split-composition", 20], ["editorial", 10],
  ],
};

const PERSONALITY_BUILDERS: Record<
  PersonalityId,
  (post: ContentRow, cfg: StyleCfg, analysis: HookAnalysis, rng: () => number, W: number, H: number) => DesignElement[]
> = {
  "hero-statement":    buildHeroStatement,
  "editorial":         buildEditorial,
  "quote-focus":       buildQuoteFocus,
  "split-composition": buildSplitComposition,
  "cta-punch":         buildCtaPunch,
  "minimal-luxury":    buildMinimalLuxury,
  "aggressive-viral":  buildAggressiveViral,
  "educational":       buildEducational,
};

function selectPersonality(
  role: SlideRole,
  usedPersonalities: PersonalityId[],
  rng: () => number,
): PersonalityId {
  const pool = ROLE_POOLS[role];
  // Penalise recent repeats for visual rhythm
  const adjusted: [PersonalityId, number][] = pool.map(([id, w]) => {
    const recentIdx = usedPersonalities.slice(-3).lastIndexOf(id);
    const factor = recentIdx >= 0 ? Math.pow(0.2, 3 - recentIdx) : 1;
    return [id, Math.max(w * factor, 0.5)];
  });
  return pickWeighted(
    adjusted.map(([id]) => id),
    adjusted.map(([, w]) => w),
    rng,
  );
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function buildSlideDesign(
  post: ContentRow,
  styleKey: TemplateStyle,
  slideIndex: number,
  totalSlides: number,
  usedLayoutIds: string[],
): { data: DesignData; layoutId: string } {
  const seed = (hashStr(post.hook + post.id) ^ (slideIndex * 2654435761)) >>> 0;
  const rng = seededRng(seed);

  const cfg = TEMPLATE_CONFIGS[styleKey];
  const analysis = analyzeHook(post.hook);
  const role = getSlideRole(slideIndex, totalSlides);
  const personality = selectPersonality(role, usedLayoutIds as PersonalityId[], rng);

  const bgList = STYLE_BACKGROUNDS[styleKey];
  const bgVariant = bgList[Math.floor(rng() * bgList.length)];

  const W = 1080, H = 1920;
  const elements = PERSONALITY_BUILDERS[personality](post, cfg, analysis, rng, W, H);

  return {
    data: {
      width: W, height: H,
      background: bgVariant.background,
      backgroundType: bgVariant.backgroundType,
      backgroundGradient: bgVariant.backgroundGradient,
      elements,
      presetName: personality,
    },
    layoutId: personality,
  };
}
