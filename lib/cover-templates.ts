/**
 * cover-templates.ts
 * ──────────────────
 * Code-based cover design template engine.
 *
 * Generates 6 fully-editable DesignData objects (1080 × 1350) without DALL-E.
 * Each template is a distinct visual style with a niche-aware colour palette.
 *
 * Templates: Minimal | Bold | Modern | Premium | Illustrated | Dark
 * Niches:    fitness | finance | food | children | productivity |
 *            photography | tech | beauty | default
 */

import type { DesignData, DesignElement } from "@/db/schema/designs-schema";

/* ─── Canvas size ────────────────────────────────────────────────────────────── */

const W = 1080;
const H = 1350;

/* ─── Niche detection ────────────────────────────────────────────────────────── */

const NICHE_KEYWORDS: Record<string, string[]> = {
  fitness:      ["fitness", "gym", "workout", "exercise", "muscle", "weight", "training", "body", "health"],
  finance:      ["finance", "money", "budget", "invest", "wealth", "income", "passive", "crypto", "trading", "debt", "profit"],
  food:         ["food", "recipe", "cook", "meal", "diet", "nutrition", "eating", "kitchen", "chef", "baking", "vegan"],
  children:     ["child", "kids", "parent", "toddler", "baby", "school", "learning", "family", "education", "parenting"],
  productivity: ["productivity", "planner", "notion", "habit", "journal", "system", "organis", "organiz", "routine", "time", "focus"],
  photography:  ["photo", "camera", "portrait", "landscape", "lightroom", "editing", "shoot", "lens", "photographer"],
  tech:         ["ai", "tech", "code", "software", "programming", "developer", "digital", "automation", "prompt", "chatgpt", "llm", "api"],
  beauty:       ["beauty", "makeup", "skin", "skincare", "hair", "fashion", "style", "glow", "cosmetic", "influencer"],
};

export type Niche =
  | "fitness" | "finance" | "food" | "children"
  | "productivity" | "photography" | "tech" | "beauty" | "default";

export function detectNiche(name: string, description = ""): Niche {
  const text = (name + " " + description).toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return niche as Niche;
  }
  return "default";
}

/* ─── Palettes ───────────────────────────────────────────────────────────────── */

export interface Palette {
  primary:   string;  // main brand colour
  secondary: string;  // darker/lighter variant
  accent:    string;  // highlight / CTA colour
  bg:        string;  // light page background
  darkBg:    string;  // dark page background
  text:      string;  // dark text (on light bg)
}

export const PALETTES: Record<Niche, Palette> = {
  fitness: {
    primary: "#F97316", secondary: "#C2410C", accent: "#FBBF24",
    bg: "#FFF7ED", darkBg: "#0c0800", text: "#1C1917",
  },
  finance: {
    primary: "#1E3A5F", secondary: "#1E40AF", accent: "#F59E0B",
    bg: "#EFF6FF", darkBg: "#05091a", text: "#0F172A",
  },
  food: {
    primary: "#DC2626", secondary: "#991B1B", accent: "#F97316",
    bg: "#FFF5F5", darkBg: "#140000", text: "#1C1917",
  },
  children: {
    primary: "#7C3AED", secondary: "#6D28D9", accent: "#10B981",
    bg: "#F5F3FF", darkBg: "#0d0820", text: "#1C1917",
  },
  productivity: {
    primary: "#6366F1", secondary: "#4338CA", accent: "#06B6D4",
    bg: "#EEF2FF", darkBg: "#03030f", text: "#0F172A",
  },
  photography: {
    primary: "#374151", secondary: "#111827", accent: "#D1D5DB",
    bg: "#F9FAFB", darkBg: "#030712", text: "#111827",
  },
  tech: {
    primary: "#4F46E5", secondary: "#4338CA", accent: "#22D3EE",
    bg: "#EEF2FF", darkBg: "#020210", text: "#0F172A",
  },
  beauty: {
    primary: "#DB2777", secondary: "#9D174D", accent: "#FBBF24",
    bg: "#FFF0F6", darkBg: "#100009", text: "#1C1917",
  },
  default: {
    primary: "#6366F1", secondary: "#4338CA", accent: "#F59E0B",
    bg: "#F5F3FF", darkBg: "#03030f", text: "#0F172A",
  },
};

/* ─── Element helpers ────────────────────────────────────────────────────────── */

function shape(
  id: string,
  x: number, y: number, w: number, h: number,
  overrides: Partial<DesignElement> = {},
): DesignElement {
  return {
    id,
    type:        "shape",
    shapeType:   "rectangle",
    fill:        "#000000",
    x, y,
    width:  w,
    height: h,
    ...overrides,
  } as DesignElement;
}

function txt(
  id: string,
  content: string,
  x: number, y: number, w: number, h: number,
  overrides: Partial<DesignElement> = {},
): DesignElement {
  return {
    id,
    type:       "text",
    content,
    fontSize:   32,
    fontFamily: "Inter",
    fontWeight: "400",
    color:      "#000000",
    textAlign:  "left",
    lineHeight: 1.2,
    x, y,
    width:  w,
    height: h,
    ...overrides,
  } as DesignElement;
}

/* ─── Cover input ────────────────────────────────────────────────────────────── */

export interface CoverInput {
  title:    string;
  subtitle: string;
  author:   string;
  category: string;
  niche:    Niche;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE 1 — MINIMAL
   White background, accent bar, left column, geometric accents, brand strip
═══════════════════════════════════════════════════════════════════════════════ */

function buildMinimal(input: CoverInput, pal: Palette): DesignData {
  const { title, subtitle, author, category } = input;
  return {
    width: W, height: H,
    background: "#FFFFFF",
    elements: [
      // Top accent bar
      shape("bar-top",    0, 0, W, 10, { fill: pal.primary, zIndex: 1 }),
      // Left accent strip
      shape("bar-left",   60, 100, 6, 220, { fill: pal.primary, borderRadius: 3, zIndex: 1 }),
      // Category label
      txt("cat", category.toUpperCase(),
        90, 110, 500, 40,
        { fontSize: 13, fontWeight: "700", color: pal.primary, letterSpacing: 3, zIndex: 2 }),
      // "A Complete Guide to" pre-title
      txt("pre", "A Complete Guide to",
        90, 160, 600, 36,
        { fontSize: 18, fontWeight: "400", color: "#9CA3AF", zIndex: 2 }),
      // Decorative squares — top right
      shape("deco-a", W - 230, 60, 170, 170,
        { fill: pal.primary, opacity: 0.07, borderRadius: 20, zIndex: 0 }),
      shape("deco-b", W - 175, 115, 170, 170,
        { fill: pal.accent, opacity: 0.07, borderRadius: 20, zIndex: 0 }),
      // Main title
      txt("title", title,
        80, 360, W - 160, 330,
        { fontSize: 72, fontWeight: "800", color: pal.text, lineHeight: 1.05, zIndex: 2 }),
      // Accent separator
      shape("sep", 80, 740, 80, 5, { fill: pal.accent, borderRadius: 3, zIndex: 2 }),
      // Subtitle
      txt("sub", subtitle,
        80, 765, W - 160, 220,
        { fontSize: 26, fontWeight: "400", color: "#6B7280", lineHeight: 1.55, zIndex: 2 }),
      // Bottom brand band
      shape("band", 0, H - 110, W, 110, { fill: pal.primary, zIndex: 1 }),
      txt("author", `By ${author}`,
        80, H - 78, W - 160, 54,
        { fontSize: 22, fontWeight: "600", color: "#FFFFFF", zIndex: 2 }),
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE 2 — BOLD
   Full primary colour, giant white title, circles for depth, accent stripe
═══════════════════════════════════════════════════════════════════════════════ */

function buildBold(input: CoverInput, pal: Palette): DesignData {
  const { title, subtitle, author, category } = input;
  return {
    width: W, height: H,
    background: pal.primary,
    elements: [
      // Depth circles
      shape("circ-a", W - 360, -150, 560, 560,
        { fill: "#FFFFFF", opacity: 0.07, borderRadius: 280, zIndex: 0 }),
      shape("circ-b", -200, H - 450, 520, 520,
        { fill: "#FFFFFF", opacity: 0.05, borderRadius: 260, zIndex: 0 }),
      // Accent top stripe
      shape("stripe", 0, 0, W, 14, { fill: pal.accent, zIndex: 2 }),
      // Category pill background
      shape("cat-bg", 80, 80, 200, 42,
        { fill: "#FFFFFF", opacity: 0.18, borderRadius: 21, zIndex: 1 }),
      txt("cat", category.toUpperCase(),
        80, 83, 200, 42,
        { fontSize: 12, fontWeight: "700", color: "#FFFFFF", letterSpacing: 2, textAlign: "center", zIndex: 2 }),
      // Giant title
      txt("title", title,
        80, 350, W - 120, 440,
        { fontSize: 90, fontWeight: "900", color: "#FFFFFF", lineHeight: 0.98, zIndex: 2 }),
      // Under-title accent
      shape("under", 80, 838, 130, 8,
        { fill: pal.accent, borderRadius: 4, zIndex: 2 }),
      // Subtitle
      txt("sub", subtitle,
        80, 875, W - 160, 220,
        { fontSize: 28, fontWeight: "300", color: "#FFFFFFCC", lineHeight: 1.5, zIndex: 2 }),
      // Author
      txt("author", author.toUpperCase(),
        80, H - 95, W - 160, 56,
        { fontSize: 15, fontWeight: "600", color: "#FFFFFF80", letterSpacing: 3, zIndex: 2 }),
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE 3 — MODERN
   Gradient background, frosted badge, dot grid, centred layout
═══════════════════════════════════════════════════════════════════════════════ */

function buildModern(input: CoverInput, pal: Palette): DesignData {
  const { title, subtitle, author, category } = input;

  // 3 × 3 dot grid (top-right corner accent)
  const dots: DesignElement[] = [0, 1, 2].flatMap(r =>
    [0, 1, 2].map(c =>
      shape(`dot-${r}-${c}`, W - 155 + c * 36, 190 + r * 36, 14, 14,
        { fill: "#FFFFFF", opacity: 0.18, borderRadius: 7, zIndex: 0 }),
    ),
  );

  return {
    width: W, height: H,
    background: pal.primary,
    backgroundType: "gradient",
    backgroundGradient: { color1: pal.primary, color2: pal.secondary, angle: 135 },
    elements: [
      // Glow behind title area
      shape("glow", W / 2 - 240, -120, 480, 480,
        { fill: "#FFFFFF", opacity: 0.06, borderRadius: 240, zIndex: 0 }),
      // Subtle grid lines
      shape("gl-h", 0, H / 3, W, 1, { fill: "#FFFFFF", opacity: 0.04, zIndex: 0 }),
      shape("gl-v", W / 3, 0, 1, H, { fill: "#FFFFFF", opacity: 0.04, zIndex: 0 }),
      ...dots,
      // Category frosted pill
      shape("cat-bg", W / 2 - 110, 100, 220, 46,
        { fill: "#FFFFFF", opacity: 0.14, borderRadius: 23, zIndex: 1 }),
      txt("cat", category.toUpperCase(),
        W / 2 - 110, 103, 220, 46,
        { fontSize: 13, fontWeight: "700", color: "#FFFFFF", letterSpacing: 2, textAlign: "center", zIndex: 2 }),
      // Title
      txt("title", title,
        80, 430, W - 160, 360,
        { fontSize: 74, fontWeight: "800", color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, zIndex: 2 }),
      // Centre separator dot
      shape("sep-dot", W / 2 - 48, 836, 96, 5,
        { fill: pal.accent, borderRadius: 3, zIndex: 2 }),
      // Subtitle
      txt("sub", subtitle,
        80, 866, W - 160, 220,
        { fontSize: 26, fontWeight: "300", color: "#FFFFFFCC", textAlign: "center", lineHeight: 1.55, zIndex: 2 }),
      // Author pill
      shape("auth-bg", W / 2 - 130, H - 100, 260, 50,
        { fill: "#FFFFFF", opacity: 0.12, borderRadius: 25, zIndex: 1 }),
      txt("author", `By ${author}`,
        W / 2 - 130, H - 97, 260, 50,
        { fontSize: 18, fontWeight: "500", color: "#FFFFFF", textAlign: "center", zIndex: 2 }),
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE 4 — PREMIUM
   Very dark background, corner bracket lines, gold accents, elegant centred
═══════════════════════════════════════════════════════════════════════════════ */

function buildPremium(input: CoverInput, pal: Palette): DesignData {
  const { title, subtitle, author, category } = input;
  const A = pal.accent;
  return {
    width: W, height: H,
    background: pal.darkBg || "#0a0a14",
    elements: [
      // Corner brackets — top-left
      shape("btlh", 40, 40, 130, 2, { fill: A, zIndex: 1 }),
      shape("btlv", 40, 40, 2, 130, { fill: A, zIndex: 1 }),
      // Corner brackets — top-right
      shape("btrh", W - 170, 40, 130, 2, { fill: A, zIndex: 1 }),
      shape("btrv", W - 42, 40, 2, 130, { fill: A, zIndex: 1 }),
      // Corner brackets — bottom-left
      shape("bblh", 40, H - 42, 130, 2, { fill: A, zIndex: 1 }),
      shape("bblv", 40, H - 170, 2, 130, { fill: A, zIndex: 1 }),
      // Corner brackets — bottom-right
      shape("bbrh", W - 170, H - 42, 130, 2, { fill: A, zIndex: 1 }),
      shape("bbrv", W - 42, H - 170, 2, 130, { fill: A, zIndex: 1 }),
      // Category
      txt("cat", category.toUpperCase(),
        0, 210, W, 40,
        { fontSize: 13, fontWeight: "400", color: A, letterSpacing: 7, textAlign: "center", zIndex: 2 }),
      // Thin top separator
      shape("sep-top", W / 2 - 70, 268, 140, 1,
        { fill: A, opacity: 0.5, zIndex: 2 }),
      // Title
      txt("title", title,
        90, 320, W - 180, 390,
        { fontSize: 66, fontWeight: "700", color: "#FFFFFF", textAlign: "center", lineHeight: 1.1, zIndex: 2 }),
      // Gold mid separator
      shape("sep-mid", W / 2 - 70, 760, 140, 2, { fill: A, zIndex: 2 }),
      // Subtitle
      txt("sub", subtitle,
        90, 797, W - 180, 260,
        { fontSize: 24, fontWeight: "300", color: "#FFFFFF70", textAlign: "center", lineHeight: 1.65, zIndex: 2 }),
      // Author
      txt("author", `— ${author} —`,
        0, H - 120, W, 56,
        { fontSize: 18, fontWeight: "400", color: A, letterSpacing: 3, textAlign: "center", zIndex: 2 }),
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE 5 — ILLUSTRATED
   Light bg, scattered circles + rotated rectangles, vibrant pill badge, left-aligned
═══════════════════════════════════════════════════════════════════════════════ */

function buildIllustrated(input: CoverInput, pal: Palette): DesignData {
  const { title, subtitle, author, category } = input;
  return {
    width: W, height: H,
    background: pal.bg || "#F8F9FA",
    elements: [
      // Scattered circles
      shape("c1", -90, 60, 290, 290,  { fill: pal.primary, opacity: 0.11, borderRadius: 145, zIndex: 0 }),
      shape("c2", W - 190, 190, 240, 240, { fill: pal.accent,   opacity: 0.14, borderRadius: 120, zIndex: 0 }),
      shape("c3", 100, H - 320, 200, 200, { fill: pal.primary, opacity: 0.09, borderRadius: 100, zIndex: 0 }),
      shape("c4", W - 130, H - 210, 220, 220, { fill: pal.secondary, opacity: 0.07, borderRadius: 110, zIndex: 0 }),
      // Rotated decorative squares
      shape("sq1", W - 110, 400, 65, 65,
        { fill: pal.accent, opacity: 0.22, borderRadius: 12, rotation: 45, zIndex: 0 }),
      shape("sq2", 55, 570, 44, 44,
        { fill: pal.primary, opacity: 0.18, borderRadius: 8, rotation: 22, zIndex: 0 }),
      // Category badge
      shape("cat-bg", 80, 120, 210, 46,
        { fill: pal.primary, borderRadius: 23, zIndex: 1 }),
      txt("cat", category.toUpperCase(),
        80, 123, 210, 46,
        { fontSize: 13, fontWeight: "700", color: "#FFFFFF", letterSpacing: 2, textAlign: "center", zIndex: 2 }),
      // Title
      txt("title", title,
        80, 390, W - 160, 360,
        { fontSize: 70, fontWeight: "800", color: pal.text, lineHeight: 1.07, zIndex: 2 }),
      // Double separator
      shape("sep1", 80, 803, 104, 6, { fill: pal.accent, borderRadius: 3, zIndex: 2 }),
      shape("sep2", 196, 806, 44, 6,  { fill: pal.primary, opacity: 0.4, borderRadius: 3, zIndex: 2 }),
      // Subtitle
      txt("sub", subtitle,
        80, 842, W - 160, 220,
        { fontSize: 26, fontWeight: "400", color: "#4B5563", lineHeight: 1.55, zIndex: 2 }),
      // Author
      txt("author", `By ${author}`,
        80, H - 96, W - 160, 58,
        { fontSize: 20, fontWeight: "600", color: pal.primary, zIndex: 2 }),
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEMPLATE 6 — DARK MODE
   Near-black bg, primary glow blobs, thin accent top bar, centred, dramatic
═══════════════════════════════════════════════════════════════════════════════ */

function buildDark(input: CoverInput, pal: Palette): DesignData {
  const { title, subtitle, author, category } = input;

  // Subtle horizontal scan lines (5)
  const scanLines: DesignElement[] = [0, 1, 2, 3, 4].map(i =>
    shape(`scan-${i}`, 0, 220 + i * 200, W, 1,
      { fill: "#FFFFFF", opacity: 0.022, zIndex: 0 }),
  );

  return {
    width: W, height: H,
    background: "#080810",
    elements: [
      // Glow blobs
      shape("glow-a", W / 2 - 320, -230, 640, 640,
        { fill: pal.primary, opacity: 0.09, borderRadius: 320, zIndex: 0 }),
      shape("glow-b", -120, H - 440, 420, 420,
        { fill: pal.accent, opacity: 0.055, borderRadius: 210, zIndex: 0 }),
      ...scanLines,
      // Top accent line
      shape("top-line", 0, 0, W, 4, { fill: pal.primary, zIndex: 2 }),
      // Category
      txt("cat", `✦  ${category.toUpperCase()}  ✦`,
        0, 60, W, 40,
        { fontSize: 13, fontWeight: "500", color: pal.primary, letterSpacing: 4, textAlign: "center", zIndex: 2 }),
      // Title
      txt("title", title,
        80, 370, W - 160, 390,
        { fontSize: 78, fontWeight: "900", color: "#FFFFFF", textAlign: "center", lineHeight: 1.05, zIndex: 2 }),
      // Glowing accent bar
      shape("glow-bar", W / 2 - 90, 812, 180, 5,
        { fill: pal.primary, borderRadius: 3, zIndex: 2 }),
      // Subtitle
      txt("sub", subtitle,
        80, 850, W - 160, 240,
        { fontSize: 27, fontWeight: "300", color: "#FFFFFF7A", textAlign: "center", lineHeight: 1.55, zIndex: 2 }),
      // Author
      txt("author", `By ${author}`.toUpperCase(),
        0, H - 95, W, 56,
        { fontSize: 14, fontWeight: "400", color: "#FFFFFF38", letterSpacing: 4, textAlign: "center", zIndex: 2 }),
    ],
  };
}

/* ─── Public API ─────────────────────────────────────────────────────────────── */

export interface CoverConcept {
  id:    string;
  name:  string;
  label: string;
  style: string;
  data:  DesignData;
}

const CONCEPT_DEFS = [
  { id: "minimal",     name: "Minimal",      label: "Clean & Minimal",      builder: buildMinimal     },
  { id: "bold",        name: "Bold",          label: "Bold & Impactful",     builder: buildBold        },
  { id: "modern",      name: "Modern",        label: "Modern Gradient",      builder: buildModern      },
  { id: "premium",     name: "Premium",       label: "Premium Dark",         builder: buildPremium     },
  { id: "illustrated", name: "Illustrated",   label: "Illustrated & Vivid",  builder: buildIllustrated },
  { id: "dark",        name: "Dark Mode",     label: "Dark Mode",            builder: buildDark        },
] as const;

export function buildAllCoverConcepts(input: CoverInput): CoverConcept[] {
  const pal = PALETTES[input.niche] ?? PALETTES.default;
  return CONCEPT_DEFS.map(c => ({
    id:    c.id,
    name:  c.name,
    label: c.label,
    style: c.id,
    data:  c.builder(input, pal),
  }));
}
