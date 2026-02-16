/**
 * UGC Lab — Get format config for a ranking template.
 * Used by video composition and overlay logic. Configuration-driven.
 */

import { RANKING_TEMPLATES } from "./ranking-templates";
import { getRankingFormat, type RankingFormat } from "./ranking-formats";

/**
 * Get the ranking format config for a template.
 * Returns format (script_structure_type, visual_layout_type, animation_style, etc.)
 * or undefined if template has no format or format not found.
 */
export function getFormatForTemplate(
  templateId: string | null | undefined
): RankingFormat | undefined {
  const t = templateId ? RANKING_TEMPLATES.find((x) => x.id === templateId) : undefined;
  const formatId = t?.formatId;
  return formatId ? getRankingFormat(formatId) : undefined;
}
