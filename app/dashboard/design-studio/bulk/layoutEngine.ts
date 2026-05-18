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

// ── Slide role (carousel flow) ─────────────────────────────────────────────────

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
  "NEW","WAKE","QUIT","DO",
]);

type HookAnalysis = {
  wordCount: number;
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
  const hasPower = words.slice(0, 4).some((w) =>
    POWER_WORDS.has(w.replace(/[^A-Z]/g, "").toUpperCase())
  );

  let intensity: HookAnalysis["intensity"] = "medium";
  if (hasExclamation || uppercaseRatio > 0.55 || hasPower) intensity = "high";
  else if (isQuestion || wordCount <= 5) intensity = "medium";
  else intensity = "low";

  return {
    wordCount,
    isQuestion,
    intensity,
    lengthClass: wordCount <= 5 ? "short" : wordCount <= 10 ? "medium" : "long",
  };
}

// ── Dynamic font sizing ────────────────────────────────────────────────────────

const LAYOUT_FONT_SIZES: Record<string, [number, number, number]> = {
  // layout id → [short, medium, long] hook font sizes
  "centered-hook":      [108, 86, 66],
  "bold-hero":          [140, 108, 82],
  "story-card":         [90, 72, 58],
  "left-aligned":       [96, 76, 60],
  "oversized-headline": [160, 124, 96],
  "split-layout":       [88, 70, 56],
  "minimal-cta":        [110, 88, 68],
  "quote-focused":      [84, 68, 54],
  "cta-banner":         [96, 76, 60],
  "stacked-spacious":   [104, 82, 64],
  "top-anchored":       [100, 80, 62],
  "bottom-punch":       [108, 86, 66],
  "asymmetric-left":    [92, 74, 58],
  "impact-statement":   [150, 116, 90],
  "editorial":          [78, 62, 50],
};

function hookFontSize(analysis: HookAnalysis, layoutId: string): number {
  const [s, m, l] = LAYOUT_FONT_SIZES[layoutId] ?? [100, 80, 62];
  return analysis.lengthClass === "short" ? s : analysis.lengthClass === "medium" ? m : l;
}

// ── Layout selection ───────────────────────────────────────────────────────────

type LayoutId =
  | "centered-hook" | "bold-hero" | "story-card" | "left-aligned"
  | "oversized-headline" | "split-layout" | "minimal-cta" | "quote-focused"
  | "cta-banner" | "stacked-spacious" | "top-anchored" | "bottom-punch"
  | "asymmetric-left" | "impact-statement" | "editorial";

const ROLE_POOLS: Record<SlideRole, [LayoutId, number][]> = {
  hook: [
    ["bold-hero", 25], ["oversized-headline", 22], ["impact-statement", 20],
    ["centered-hook", 18], ["bottom-punch", 10], ["minimal-cta", 5],
  ],
  supporting: [
    ["left-aligned", 22], ["split-layout", 20], ["editorial", 18],
    ["stacked-spacious", 15], ["story-card", 15], ["top-anchored", 10],
  ],
  tip: [
    ["story-card", 20], ["left-aligned", 18], ["editorial", 18],
    ["split-layout", 16], ["top-anchored", 14], ["cta-banner", 14],
  ],
  emotional: [
    ["centered-hook", 25], ["quote-focused", 25], ["stacked-spacious", 20],
    ["asymmetric-left", 15], ["bold-hero", 15],
  ],
  cta: [
    ["cta-banner", 35], ["minimal-cta", 30], ["bottom-punch", 25], ["story-card", 10],
  ],
};

function selectLayout(
  role: SlideRole,
  usedLayouts: LayoutId[],
  rng: () => number,
): LayoutId {
  const pool = ROLE_POOLS[role];
  // Penalise recently used layouts for visual rhythm
  const adjusted: [LayoutId, number][] = pool.map(([id, w]) => {
    const recentIdx = usedLayouts.slice(-3).lastIndexOf(id);
    const factor = recentIdx >= 0 ? Math.pow(0.25, 3 - recentIdx) : 1;
    return [id, Math.max(w * factor, 0.5)];
  });
  return pickWeighted(adjusted.map(([id]) => id), adjusted.map(([, w]) => w), rng);
}

// ── Background variation ───────────────────────────────────────────────────────

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

// ── Spacing variation ──────────────────────────────────────────────────────────

type SpacingVariant = { topPad: number; sidePad: number; gapExtra: number; ctaLift: number };

function getSpacing(rng: () => number): SpacingVariant {
  return {
    topPad:  Math.round(rng() * 80),
    sidePad: Math.round(rng() * 40),
    gapExtra: Math.round(rng() * 40),
    ctaLift:  Math.round(rng() * 30),
  };
}

// ── Template style configs ─────────────────────────────────────────────────────

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

// ── Element builders ───────────────────────────────────────────────────────────

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

function buildElements(
  post: ContentRow,
  cfg: StyleCfg,
  layoutId: LayoutId,
  analysis: HookAnalysis,
  sp: SpacingVariant,
  W: number,
  H: number,
): DesignElement[] {
  const fs = hookFontSize(analysis, layoutId);
  const bodyFs = analysis.lengthClass === "long" ? 42 : 46;
  const ctaFs = 40;
  const side = 80 + sp.sidePad;
  const tw = W - side * 2;

  // Estimate how many px a block of hook text needs vertically
  const hookH = (len: number) => Math.max(fs * (len + 1) * 0.82, fs * 2.5);

  switch (layoutId) {
    case "centered-hook": {
      const hY = 380 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 60 + sp.gapExtra;
      const cY = H - 260 - sp.ctaLift;
      return [
        rect("accent", W / 2 - 60, hY - 60, 120, 6, cfg.accentColor, { borderRadius: 3 }),
        txt("hook", post.hook, side, hY, tw, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 440, { fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5 }),
        txt("cta", post.cta, side, cY, tw, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "bold-hero": {
      const hY = 200 + sp.topPad;
      const hH = Math.max(hookH(analysis.wordCount), 480);
      const bY = hY + hH + 80 + sp.gapExtra;
      return [
        txt("hook", post.hook, 60, hY, W - 120, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.0 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 380, { fontSize: bodyFs - 4, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.45 }),
        txt("cta", post.cta, side, H - 200, tw, 100, { fontSize: ctaFs - 2, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "story-card": {
      const hY = 480 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 60 + sp.gapExtra;
      const ctaBoxY = H - 300 - sp.ctaLift;
      return [
        rect("accent-top", W / 2 - 80, hY - 70, 160, 5, cfg.accentColor, { borderRadius: 3 }),
        txt("hook", post.hook, side, hY, tw, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.15 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 440, { fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5 }),
        txt("cta", post.cta, side + 40, ctaBoxY, tw - 80, 140, { fontSize: ctaFs - 2, fontFamily: cfg.bodyFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", textBackground: cfg.accentColor }),
      ];
    }

    case "left-aligned": {
      const hY = 340 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 70 + sp.gapExtra;
      const cY = H - 280 - sp.ctaLift;
      return [
        rect("accent-bar", 80, hY - 50, 8, Math.min(hH + 60, 480), cfg.accentColor, { borderRadius: 4 }),
        txt("hook", post.hook, 120, hY, W - 200, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "left", lineHeight: 1.12 }),
        txt("body", post.mainText, 120, bY, W - 240, 460, { fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "left", lineHeight: 1.5 }),
        txt("cta", post.cta, 120, cY, W - 240, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "left" }),
      ];
    }

    case "oversized-headline": {
      const hY = 160 + sp.topPad;
      const hH = Math.round(H * 0.54);
      const bY = hY + hH + 60 + sp.gapExtra;
      return [
        txt("hook", post.hook, 60, hY, W - 120, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 0.95 }),
        rect("divider", side, bY - 30, tw, 3, cfg.accentColor, { borderRadius: 2 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 300, { fontSize: bodyFs - 6, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.4, opacity: 0.8 }),
        txt("cta", post.cta, side, H - 200, tw, 100, { fontSize: ctaFs - 4, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "split-layout": {
      const hY = 320 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const divY = hY + hH + 60;
      const bY = divY + 60 + sp.gapExtra;
      const cY = H - 240 - sp.ctaLift;
      return [
        txt("hook", post.hook, side, hY, tw, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }),
        rect("divider", side + 40, divY, tw - 80, 4, cfg.accentColor, { borderRadius: 2 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 440, { fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5 }),
        txt("cta", post.cta, side, cY, tw, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "minimal-cta": {
      const hY = 440 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 60 + sp.gapExtra;
      const ctaBgY = H - 380 - sp.ctaLift;
      return [
        txt("hook", post.hook, side + 20, hY, tw - 40, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }),
        txt("body", post.mainText, side + 40, bY, tw - 80, 380, { fontSize: bodyFs - 4, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5, opacity: 0.85 }),
        rect("cta-bg", side, ctaBgY, tw, 220, cfg.accentColor, { borderRadius: 20 }),
        txt("cta", post.cta, side + 20, ctaBgY + 40, tw - 40, 140, { fontSize: ctaFs + 4, fontFamily: cfg.bodyFont, color: "#FFFFFF", fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "quote-focused": {
      const qY = 340 + sp.topPad;
      const hY = qY + 80;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 80 + sp.gapExtra;
      const cY = H - 240 - sp.ctaLift;
      return [
        txt("quote-mark", "“", 80, qY, 160, 160, { fontSize: 200, fontFamily: cfg.hookFont, color: cfg.accentColor, opacity: 0.25, lineHeight: 1, fontWeight: "bold" }),
        txt("hook", post.hook, side + 20, hY, tw - 40, hH, { fontSize: fs - 4, fontFamily: cfg.hookFont, color: cfg.headingColor, fontStyle: "italic", textAlign: "center", lineHeight: 1.2 }),
        txt("body", post.mainText, side + 40, bY, tw - 80, 400, { fontSize: bodyFs - 4, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5, opacity: 0.8 }),
        txt("cta", post.cta, side, cY, tw, 120, { fontSize: ctaFs - 2, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "cta-banner": {
      const hY = 320 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 70 + sp.gapExtra;
      const bannerH = 280;
      const bannerY = H - bannerH;
      return [
        rect("accent-dot", W / 2 - 50, hY - 70, 100, 6, cfg.accentColor, { borderRadius: 3 }),
        txt("hook", post.hook, side, hY, tw, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 520, { fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.5 }),
        rect("banner", 0, bannerY, W, bannerH, cfg.accentColor),
        txt("cta", post.cta, 60, bannerY + 80, W - 120, 140, { fontSize: ctaFs + 4, fontFamily: cfg.bodyFont, color: "#FFFFFF", fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "stacked-spacious": {
      const hY = 520 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 120 + sp.gapExtra;
      const cY = H - 320 - sp.ctaLift;
      return [
        rect("accent", W / 2 - 40, hY - 80, 80, 4, cfg.accentColor, { borderRadius: 2 }),
        txt("hook", post.hook, side + 20, hY, tw - 40, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.15 }),
        txt("body", post.mainText, side + 40, bY, tw - 80, 440, { fontSize: bodyFs - 2, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.6 }),
        txt("cta", post.cta, side + 20, cY, tw - 40, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "top-anchored": {
      const hY = 120 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 80 + sp.gapExtra;
      const cY = H - 260 - sp.ctaLift;
      return [
        txt("hook", post.hook, side, hY, tw, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.05 }),
        rect("divider", side + 20, bY - 40, tw - 40, 4, cfg.accentColor, { borderRadius: 2 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 520, { fontSize: bodyFs, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.55 }),
        txt("cta", post.cta, side, cY, tw, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "bottom-punch": {
      const hY = 240 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 60 + sp.gapExtra;
      const ctaY = Math.max(bY + 320 + sp.ctaLift, H - 500);
      const ctaH = H - ctaY - 80;
      return [
        txt("hook", post.hook, side, hY, tw, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.05 }),
        txt("body", post.mainText, side + 30, bY, tw - 60, 320, { fontSize: bodyFs - 6, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.4, opacity: 0.75 }),
        rect("cta-area", side, ctaY - 20, tw, ctaH + 40, cfg.accentColor + "22", { borderRadius: 16 }),
        txt("cta", post.cta, side + 20, ctaY, tw - 40, ctaH, { fontSize: Math.min(ctaFs + 10, 56), fontFamily: cfg.hookFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.15 }),
      ];
    }

    case "asymmetric-left": {
      const hY = 380 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 80 + sp.gapExtra;
      const cY = H - 260 - sp.ctaLift;
      return [
        rect("accent-bar", 80, hY - 40, 6, Math.min(hH + 80, 500), cfg.accentColor, { borderRadius: 3 }),
        txt("hook", post.hook, 120, hY, W - 240, hH, { fontSize: fs - 4, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "left", lineHeight: 1.1 }),
        txt("body", post.mainText, 160, bY, W - 300, 460, { fontSize: bodyFs - 4, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "left", lineHeight: 1.5 }),
        txt("cta", post.cta, side, cY, tw, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "impact-statement": {
      const hY = 240 + sp.topPad;
      const hH = Math.round(H * 0.52);
      const bY = hY + hH + 60 + sp.gapExtra;
      return [
        txt("hook", post.hook, 60, hY, W - 120, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 0.92, letterSpacing: -2 }),
        txt("body", post.mainText, side + 40, bY, tw - 80, 320, { fontSize: bodyFs - 8, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.4, opacity: 0.7 }),
        rect("cta-line", side, H - 216, tw, 3, cfg.accentColor, { borderRadius: 2 }),
        txt("cta", post.cta, side, H - 200, tw, 100, { fontSize: ctaFs - 4, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }

    case "editorial": {
      const hY = 200 + sp.topPad;
      const hH = hookH(analysis.wordCount);
      const bY = hY + hH + 100 + sp.gapExtra;
      const cY = H - 280 - sp.ctaLift;
      return [
        rect("top-line", side, hY - 50, tw, 2, cfg.accentColor, { borderRadius: 1 }),
        txt("hook", post.hook, side + 20, hY, tw - 40, hH, { fontSize: fs, fontFamily: cfg.hookFont, color: cfg.headingColor, fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }),
        rect("bot-line", side, hY + hH + 40, tw, 2, cfg.accentColor + "66", { borderRadius: 1 }),
        txt("body", post.mainText, side + 20, bY, tw - 40, 520, { fontSize: bodyFs + 2, fontFamily: cfg.bodyFont, color: cfg.bodyColor, textAlign: "center", lineHeight: 1.6 }),
        txt("cta", post.cta, side + 20, cY, tw - 40, 120, { fontSize: ctaFs, fontFamily: cfg.bodyFont, color: cfg.accentColor, fontWeight: "bold", textAlign: "center" }),
      ];
    }
  }
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
  const layoutId = selectLayout(role, usedLayoutIds as LayoutId[], rng);

  const bgList = STYLE_BACKGROUNDS[styleKey];
  const bgVariant = bgList[Math.floor(rng() * bgList.length)];
  const spacing = getSpacing(rng);

  const W = 1080, H = 1920;
  const elements = buildElements(post, cfg, layoutId, analysis, spacing, W, H);

  return {
    data: {
      width: W, height: H,
      background: bgVariant.background,
      backgroundType: bgVariant.backgroundType,
      backgroundGradient: bgVariant.backgroundGradient,
      elements,
      presetName: layoutId,
    },
    layoutId,
  };
}
