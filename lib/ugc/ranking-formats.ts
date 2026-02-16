/**
 * UGC Lab — Multiple Ranking Formats.
 * Configuration-driven. Influences script structure, video composition, overlay animation.
 * No hardcoded format behavior in UI.
 */

/** How the script is structured (drives generate-ranking-script) */
export type ScriptStructureType =
  | "countdown_reveal"   // "At 3... at 2... at 1: winner"
  | "scoreboard_list"    // "Number 3: X. Number 2: Y. Number 1: Z."
  | "tier_announce"      // "B tier: X. A tier: Y. S tier: Z."
  | "vs_elimination";    // "X vs Y. Winner: Z." or "X eliminated. Y wins."

/** Visual layout for video composition */
export type VisualLayoutType =
  | "countdown_center"   // Big countdown numbers, product zooms in at 1
  | "scoreboard_stack"   // Vertical list with scores/ranks
  | "tier_podium"        // S/A/B tier shelves, products on tiers
  | "vs_arena";          // Two sides, head-to-head, winner spotlight

/** Overlay animation behavior */
export type AnimationStyle =
  | "countdown_flip"     // 5…4…3…2…1 number flip
  | "scoreboard_slide"   // Ranks slide up into position
  | "tier_drop"          // Products drop into tier slots
  | "vs_smash";          // Dramatic reveal, loser fades, winner pops

/** How segment duration is distributed across products */
export type SegmentDistributionLogic =
  | "equal"              // Each product gets same duration
  | "winner_weighted"    // Winner segment longer
  | "countdown_buildup"  // Shorter early, longer at reveal
  | "tier_weighted"      // Lower tiers shorter, top tier longer
  | "vs_rounds";         // Paired comparisons, final gets extra

export type RankingFormat = {
  format_id: string;
  name: string;
  script_structure_type: ScriptStructureType;
  visual_layout_type: VisualLayoutType;
  animation_style: AnimationStyle;
  segment_distribution_logic: SegmentDistributionLogic;
  /** Script template tokens: {{RANK}}, {{BADGE}}, {{NAME}}, {{TIER}} */
  script_template: {
    intro: string;
    rankLine: string;    // e.g. "Coming in at {{BADGE}}: {{NAME}}" or "{{TIER}} tier: {{NAME}}"
    winnerLine: string;  // e.g. "And the winner: {{NAME}}"
    outro: string;
  };
  /** Tier labels for tier_list (best first). e.g. ["S", "A", "B", "C", "D"] */
  tier_labels?: string[];
  /** Overlay animation config for video composition */
  overlay_animation: {
    entryPhase: string;
    holdPhase: string;
    winnerPhase: string;
    transitionEasing: string;
  };
  /** Segment duration weights per index (0=first, last=winner). Sum = 1. */
  segment_weights?: number[];
  /** Min/max products this format supports */
  minProducts: number;
  maxProducts: number;
};

export const RANKING_FORMATS: RankingFormat[] = [
  {
    format_id: "countdown",
    name: "Countdown",
    script_structure_type: "countdown_reveal",
    visual_layout_type: "countdown_center",
    animation_style: "countdown_flip",
    segment_distribution_logic: "countdown_buildup",
    script_template: {
      intro: "I tested these. The countdown to number one.",
      rankLine: "At {{RANK}}: {{NAME}}.",
      winnerLine: "Number one. The winner: {{NAME}}.",
      outro: "Save yourself the research.",
    },
    overlay_animation: {
      entryPhase: "countdown_flip",
      holdPhase: "hold_center",
      winnerPhase: "zoom_reveal",
      transitionEasing: "ease-out",
    },
    segment_weights: [0.12, 0.14, 0.18, 0.22, 0.34],
    minProducts: 2,
    maxProducts: 5,
  },
  {
    format_id: "scoreboard",
    name: "Scoreboard",
    script_structure_type: "scoreboard_list",
    visual_layout_type: "scoreboard_stack",
    animation_style: "scoreboard_slide",
    segment_distribution_logic: "equal",
    script_template: {
      intro: "I tested these. Here's the scoreboard.",
      rankLine: "Number {{RANK}}: {{NAME}}.",
      winnerLine: "Number one. {{NAME}} wins.",
      outro: "That's my final ranking.",
    },
    overlay_animation: {
      entryPhase: "slide_up",
      holdPhase: "scoreboard_hold",
      winnerPhase: "highlight_top",
      transitionEasing: "ease-in-out",
    },
    minProducts: 2,
    maxProducts: 5,
  },
  {
    format_id: "tier_list",
    name: "Tier List",
    script_structure_type: "tier_announce",
    visual_layout_type: "tier_podium",
    animation_style: "tier_drop",
    segment_distribution_logic: "tier_weighted",
    script_template: {
      intro: "I ranked these into tiers.",
      rankLine: "{{TIER}} tier: {{NAME}}.",
      winnerLine: "S tier. The best: {{NAME}}.",
      outro: "That's my tier list.",
    },
    overlay_animation: {
      entryPhase: "tier_drop",
      holdPhase: "tier_hold",
      winnerPhase: "s_tier_glow",
      transitionEasing: "ease-out",
    },
    segment_weights: [0.15, 0.2, 0.25, 0.4],
    tier_labels: ["S", "A", "B", "C", "D"],
    minProducts: 2,
    maxProducts: 5,
  },
  {
    format_id: "vs_battle",
    name: "VS Battle",
    script_structure_type: "vs_elimination",
    visual_layout_type: "vs_arena",
    animation_style: "vs_smash",
    segment_distribution_logic: "vs_rounds",
    script_template: {
      intro: "Head to head. Who wins?",
      rankLine: "{{NAME}} eliminated.",
      winnerLine: "The winner: {{NAME}}.",
      outro: "My pick. Your call.",
    },
    overlay_animation: {
      entryPhase: "vs_faceoff",
      holdPhase: "vs_hold",
      winnerPhase: "vs_victory",
      transitionEasing: "ease-in",
    },
    minProducts: 2,
    maxProducts: 4,
  },
];

/** Get format by ID */
export function getRankingFormat(formatId: string | null | undefined): RankingFormat | undefined {
  if (!formatId) return undefined;
  return RANKING_FORMATS.find((f) => f.format_id === formatId);
}

/** Get all formats that support the given product count */
export function getRankingFormatsForProductCount(count: number): RankingFormat[] {
  return RANKING_FORMATS.filter(
    (f) => count >= f.minProducts && count <= f.maxProducts
  );
}

/**
 * Get video composition config from format. Used by process-job / renderer.
 * Configuration-driven; no hardcoded format behavior.
 */
export function getCompositionConfig(formatId: string | null | undefined): {
  visual_layout_type: string;
  animation_style: string;
  overlay_animation: { entryPhase: string; holdPhase: string; winnerPhase: string; transitionEasing: string };
  segment_distribution_logic: string;
} | null {
  const format = getRankingFormat(formatId);
  if (!format) return null;
  return {
    visual_layout_type: format.visual_layout_type,
    animation_style: format.animation_style,
    overlay_animation: format.overlay_animation,
    segment_distribution_logic: format.segment_distribution_logic,
  };
}

/** Compute segment duration (seconds) per product index from format */
export function getSegmentDurations(
  format: RankingFormat,
  productCount: number,
  totalDurationSeconds: number
): number[] {
  const introOutro = 3;
  const usable = Math.max(1, totalDurationSeconds - introOutro);

  if (format.segment_weights && format.segment_weights.length >= productCount) {
    const weights = format.segment_weights.slice(0, productCount);
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / sum) * usable);
  }

  const equal = usable / productCount;
  return Array(productCount).fill(equal);
}
