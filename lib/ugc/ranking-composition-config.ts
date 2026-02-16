/**
 * UGC Lab — Video composition config from ranking format.
 * Configuration-driven. No hardcoded format behavior.
 * Used by process-job / video composition / overlay animation logic.
 */

import { getRankingFormat, getSegmentDurations } from "./ranking-formats";

export type CompositionConfig = {
  formatId: string;
  visualLayoutType: string;
  animationStyle: string;
  overlayAnimation: {
    entryPhase: string;
    holdPhase: string;
    winnerPhase: string;
    transitionEasing: string;
  };
  segmentDistributionLogic: string;
  segmentDurationsSeconds: number[];
};

/**
 * Get video composition config for a ranking format.
 * Use this in process-job / video renderer instead of hardcoding format behavior.
 */
export function getCompositionConfig(
  formatId: string | null | undefined,
  productCount: number,
  totalDurationSeconds: number
): CompositionConfig | null {
  const format = getRankingFormat(formatId);
  if (!format) return null;

  const segmentDurations = getSegmentDurations(format, productCount, totalDurationSeconds);

  return {
    formatId: format.format_id,
    visualLayoutType: format.visual_layout_type,
    animationStyle: format.animation_style,
    overlayAnimation: format.overlay_animation,
    segmentDistributionLogic: format.segment_distribution_logic,
    segmentDurationsSeconds: segmentDurations,
  };
}
