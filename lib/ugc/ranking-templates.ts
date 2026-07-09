/**
 * UGC Lab — Dynamic Ranking / Top List templates.
 * Supports 2–5 products. Animated rank badges (🥇🥈🥉). Dynamic text overlays.
 * Primary product highlighted as final winner.
 */

export const RANK_BADGES = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"] as const;

export type LayoutStyle =
  | "vertical_stack"   // Products stacked top-to-bottom
  | "horizontal_carousel"  // Left-to-right reveal
  | "center_zoom"      // Winner zooms to center
  | "bracket_reveal"   // Tournament-style bracket
  | "card_grid";       // 2x2 or 2x3 grid

export type AnimationStyle =
  | "slide_up"         // Rank slides up into view
  | "fade_in"          // Fade in with scale
  | "pop"              // Quick pop/bounce
  | "stagger_cascade"  // Sequential cascade
  | "flip_reveal"      // Card flip reveal
  | "countdown";       // 5…4…3…2…1 reveal

export type OverlayPosition =
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center"
  | "center_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right"
  | "inline_badge";    // Overlaid on product card

export type TextOverlayConfig = {
  /** Position of the overlay */
  position: OverlayPosition;
  /** Vertical offset in % from position anchor (0–100) */
  offsetY?: number;
  /** Horizontal offset in % from position anchor (0–100) */
  offsetX?: number;
  /** Font size scale (1 = base) */
  scale?: number;
  /** Duration in ms this overlay is visible */
  durationMs?: number;
  /** When to show: "entry" | "hold" | "exit" | "winner_reveal" */
  phase: "entry" | "hold" | "exit" | "winner_reveal";
};

export type RankingTemplate = {
  id: string;
  name: string;
  /** Category for filtering */
  category: "ranking" | "top_list";
  /** Min/max products this template supports */
  minProducts: number;
  maxProducts: number;
  /** Visual layout */
  layoutStyle: LayoutStyle;
  /** How rank badges and product cards animate */
  animationStyle: AnimationStyle;
  /** Transition timing in ms */
  transitionTiming: {
    /** Delay before first product appears */
    introDelayMs: number;
    /** Duration of each product segment (ms) */
    segmentDurationMs: number;
    /** Duration of transition between products */
    transitionDurationMs: number;
    /** Pause before winner reveal */
    winnerPauseMs: number;
    /** Duration of winner highlight animation */
    winnerRevealDurationMs: number;
  };
  /** Overlay configuration for rank badges and text */
  overlayPositions: {
    /** Position for rank badge (🥇🥈🥉) per product index */
    rankBadge: OverlayPosition;
    /** Product name overlay */
    productName: OverlayPosition;
    /** Optional "Winner" or highlight overlay for primary */
    winnerBadge: OverlayPosition;
    /** List title overlay (e.g. "Top 3 Picks") */
    listTitle: OverlayPosition;
  };
  /** Text overlay configs for dynamic content */
  textOverlays: TextOverlayConfig[];
  /** Duration per product segment (seconds) – derived from transitionTiming or override */
  durationPerProductSegment: number;
  /** Total estimated duration (seconds) */
  totalDurationSeconds: number;
  /** Highlight primary as winner at end */
  highlightPrimaryAsWinner: boolean;
  /** Format from ranking-formats.ts — drives script structure, visual layout, animation */
  formatId?: string;
  previewThumbnail: string;
};

/**
 * Compute total duration from template and product count.
 */
export function getRankingDurationSeconds(
  template: RankingTemplate,
  productCount: number
): number {
  const clamped = Math.min(template.maxProducts, Math.max(template.minProducts, productCount));
  const segmentSec = template.durationPerProductSegment;
  const transitionSec = (template.transitionTiming.transitionDurationMs / 1000) * (clamped - 1);
  const winnerSec = template.highlightPrimaryAsWinner
    ? template.transitionTiming.winnerRevealDurationMs / 1000
    : 0;
  return template.transitionTiming.introDelayMs / 1000 + clamped * segmentSec + transitionSec + winnerSec;
}

/**
 * Get rank badge for index (0-based).
 */
export function getRankBadge(index: number): string {
  return RANK_BADGES[Math.min(index, RANK_BADGES.length - 1)] ?? `${index + 1}`;
}

/**
 * Generate ranking order from stored order_index. No hardcoded logic.
 * Products are displayed in order_index order. Primary gets winner highlight via template.
 */
export function generateRankingOrder<T extends { orderIndex?: number }>(products: T[]): T[] {
  if (products.length <= 1) return [...products];
  return [...products].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

export const RANKING_TEMPLATES: RankingTemplate[] = [
  {
    id: "top-list-vertical",
    name: "Top List Vertical",
    category: "ranking",
    minProducts: 2,
    maxProducts: 5,
    layoutStyle: "vertical_stack",
    animationStyle: "slide_up",
    transitionTiming: {
      introDelayMs: 800,
      segmentDurationMs: 3500,
      transitionDurationMs: 400,
      winnerPauseMs: 600,
      winnerRevealDurationMs: 2500,
    },
    overlayPositions: {
      rankBadge: "inline_badge",
      productName: "center_left",
      winnerBadge: "center",
      listTitle: "top_center",
    },
    textOverlays: [
      { position: "top_center", phase: "entry", scale: 1.2, durationMs: 1000 },
      { position: "inline_badge", phase: "hold", scale: 1 },
      { position: "center", phase: "winner_reveal", scale: 1.3, durationMs: 2500 },
    ],
    durationPerProductSegment: 3.5,
    totalDurationSeconds: 25,
    highlightPrimaryAsWinner: true,
    formatId: "scoreboard",
    previewThumbnail: "/templates/ranking-vertical.jpg",
  },
  {
    id: "top-list-carousel",
    name: "Top List Carousel",
    category: "ranking",
    minProducts: 2,
    maxProducts: 5,
    layoutStyle: "horizontal_carousel",
    animationStyle: "stagger_cascade",
    transitionTiming: {
      introDelayMs: 500,
      segmentDurationMs: 3000,
      transitionDurationMs: 500,
      winnerPauseMs: 400,
      winnerRevealDurationMs: 3000,
    },
    overlayPositions: {
      rankBadge: "top_left",
      productName: "bottom_center",
      winnerBadge: "center",
      listTitle: "top_center",
    },
    textOverlays: [
      { position: "top_center", phase: "entry", scale: 1.1, durationMs: 800 },
      { position: "top_left", phase: "hold", scale: 1.2 },
      { position: "center", phase: "winner_reveal", scale: 1.4, durationMs: 3000 },
    ],
    durationPerProductSegment: 3,
    totalDurationSeconds: 22,
    highlightPrimaryAsWinner: true,
    formatId: "scoreboard",
    previewThumbnail: "/templates/ranking-carousel.jpg",
  },
  {
    id: "top-list-countdown",
    name: "Top List Countdown",
    category: "top_list",
    minProducts: 3,
    maxProducts: 5,
    layoutStyle: "center_zoom",
    animationStyle: "countdown",
    transitionTiming: {
      introDelayMs: 1200,
      segmentDurationMs: 4000,
      transitionDurationMs: 600,
      winnerPauseMs: 800,
      winnerRevealDurationMs: 3500,
    },
    overlayPositions: {
      rankBadge: "center",
      productName: "bottom_center",
      winnerBadge: "center",
      listTitle: "top_center",
    },
    textOverlays: [
      { position: "top_center", phase: "entry", scale: 1.3, durationMs: 1200 },
      { position: "center", phase: "hold", scale: 1.5 },
      { position: "center", phase: "winner_reveal", scale: 1.6, durationMs: 3500 },
    ],
    durationPerProductSegment: 4,
    totalDurationSeconds: 30,
    highlightPrimaryAsWinner: true,
    formatId: "countdown",
    previewThumbnail: "/templates/ranking-countdown.jpg",
  },
  {
    id: "top-list-bracket",
    name: "Top List Bracket",
    category: "top_list",
    minProducts: 2,
    maxProducts: 4,
    layoutStyle: "bracket_reveal",
    animationStyle: "flip_reveal",
    transitionTiming: {
      introDelayMs: 600,
      segmentDurationMs: 3200,
      transitionDurationMs: 450,
      winnerPauseMs: 500,
      winnerRevealDurationMs: 2800,
    },
    overlayPositions: {
      rankBadge: "inline_badge",
      productName: "center_left",
      winnerBadge: "center",
      listTitle: "top_center",
    },
    textOverlays: [
      { position: "top_center", phase: "entry", scale: 1.1, durationMs: 600 },
      { position: "inline_badge", phase: "hold", scale: 1 },
      { position: "center", phase: "winner_reveal", scale: 1.3, durationMs: 2800 },
    ],
    durationPerProductSegment: 3.2,
    totalDurationSeconds: 18,
    highlightPrimaryAsWinner: true,
    formatId: "vs_battle",
    previewThumbnail: "/templates/ranking-bracket.jpg",
  },
  {
    id: "top-list-grid",
    name: "Top List Grid",
    category: "ranking",
    minProducts: 2,
    maxProducts: 5,
    layoutStyle: "card_grid",
    animationStyle: "pop",
    transitionTiming: {
      introDelayMs: 400,
      segmentDurationMs: 2800,
      transitionDurationMs: 350,
      winnerPauseMs: 300,
      winnerRevealDurationMs: 2200,
    },
    overlayPositions: {
      rankBadge: "top_right",
      productName: "bottom_center",
      winnerBadge: "center",
      listTitle: "top_center",
    },
    textOverlays: [
      { position: "top_center", phase: "entry", scale: 1.2, durationMs: 500 },
      { position: "top_right", phase: "hold", scale: 1.1 },
      { position: "center", phase: "winner_reveal", scale: 1.3, durationMs: 2200 },
    ],
    durationPerProductSegment: 2.8,
    totalDurationSeconds: 20,
    highlightPrimaryAsWinner: true,
    formatId: "tier_list",
    previewThumbnail: "/templates/ranking-grid.jpg",
  },
];

/** Get templates that support the given product count */
export function getRankingTemplatesForProductCount(count: number): RankingTemplate[] {
  return RANKING_TEMPLATES.filter(
    (t) => count >= t.minProducts && count <= t.maxProducts
  );
}

export const RANKING_TEMPLATE_IDS = RANKING_TEMPLATES.map((t) => t.id);

export function isRankingTemplate(templateId: string | null | undefined): boolean {
  return !!templateId && RANKING_TEMPLATE_IDS.includes(templateId);
}

/** Get format ID for a ranking template. Used by script/composition/overlay logic. */
export function getFormatIdForTemplate(templateId: string | null | undefined): string | undefined {
  const t = templateId ? RANKING_TEMPLATES.find((x) => x.id === templateId) : undefined;
  return t?.formatId;
}
