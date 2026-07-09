/**
 * UGC Lab — Marketing angle engine.
 * Outputs angle_type, emotional_trigger, persuasion_style, suggested_hook_structure.
 *
 * Detection by campaign product count:
 * - Single product (1): standard conversion angles only (pain, desire, objection, etc.)
 * - Multiple products (2+): standard conversion angles + comparison-style angles (vs_comparison, stack_duo)
 */

export type MarketingAngle = {
  angle_type: string;
  emotional_trigger: string;
  persuasion_style: string;
  suggested_hook_structure: string;
  /** "single" | "both" = standard conversion angles. "multi" = comparison-style, requires 2+ products. */
  product_count: "single" | "multi" | "both";
};

/** Angle types that require 2+ products (comparison-style). Only enabled when campaign has multiple products. */
export const COMPARISON_ANGLE_TYPES = [
  "vs_comparison",
  "stack_duo",
  "ranking_style",
  "budget_vs_premium",
  "stop_buying_x",
  "top_3_tested",
  "best_under_price",
] as const;

/** Standard conversion angle types. Available for single-product campaigns. */
export const CONVERSION_ANGLE_TYPES = [
  "pain_focused",
  "desire_lifestyle",
  "objection_handling",
  "social_proof",
  "authority_comparison",
  "before_after",
  "urgency_scarcity",
] as const;

export const ANGLE_CATALOG: MarketingAngle[] = [
  {
    angle_type: "pain_focused",
    emotional_trigger: "frustration, wasted effort, disappointment",
    persuasion_style: "Problem–agitation–solution. Mirror their pain, then offer relief.",
    suggested_hook_structure: "Tired of [specific pain]? I was too. Here's what changed.",
    product_count: "both",
  },
  {
    angle_type: "desire_lifestyle",
    emotional_trigger: "aspiration, envy, future self",
    persuasion_style: "Aspirational payoff. Paint the life they want, then show the bridge.",
    suggested_hook_structure: "Imagine [desired outcome]. Picture your life with it. This made it real.",
    product_count: "both",
  },
  {
    angle_type: "objection_handling",
    emotional_trigger: "skepticism, doubt, fear of being duped",
    persuasion_style: "Address skepticism head-on. Acknowledge doubts, then disarm with proof.",
    suggested_hook_structure: "I know what you're thinking—[common objection]? I thought the same. Then I tried it.",
    product_count: "both",
  },
  {
    angle_type: "social_proof",
    emotional_trigger: "FOMO, belonging, fear of missing out",
    persuasion_style: "Bandwagon + validation. Others love it; you're invited to join.",
    suggested_hook_structure: "Everyone's talking about this. I finally tried it—they were right.",
    product_count: "both",
  },
  {
    angle_type: "authority_comparison",
    emotional_trigger: "trust in expertise, desire for best-in-class",
    persuasion_style: "Expert comparison. I've tested everything; this wins.",
    suggested_hook_structure: "I've tried everything in this category. Nothing else comes close.",
    product_count: "both",
  },
  {
    angle_type: "before_after",
    emotional_trigger: "transformation, hope, proof of change",
    persuasion_style: "Transformation narrative. Show the shift from before to after.",
    suggested_hook_structure: "Before this, I [old state]. Now I [new state]. Here's what happened.",
    product_count: "both",
  },
  {
    angle_type: "urgency_scarcity",
    emotional_trigger: "fear of loss, limited opportunity",
    persuasion_style: "Time/availability pressure. Act now or miss out.",
    suggested_hook_structure: "[Limited offer / ending soon]. Don't wait—this is the moment.",
    product_count: "both",
  },
  {
    angle_type: "vs_comparison",
    emotional_trigger: "desire for informed choice, validation",
    persuasion_style: "Head-to-head. X vs Y—clear winner. Helps them decide.",
    suggested_hook_structure: "I compared [A] vs [B]. Here's which one actually wins.",
    product_count: "multi",
  },
  {
    angle_type: "stack_duo",
    emotional_trigger: "completeness, synergy",
    persuasion_style: "These two together. Stack or pair for better results.",
    suggested_hook_structure: "These two together? Game changer. Here's why.",
    product_count: "multi",
  },
  {
    angle_type: "ranking_style",
    emotional_trigger: "desire for curated picks, trust in ranked lists",
    persuasion_style: "Ranked list. Number one wins. Clear hierarchy.",
    suggested_hook_structure: "I ranked these. Here's my #1 pick and why.",
    product_count: "multi",
  },
  {
    angle_type: "budget_vs_premium",
    emotional_trigger: "value vs quality trade-off, smart spending",
    persuasion_style: "Budget vs premium. When to save, when to spend. Clear recommendation.",
    suggested_hook_structure: "Budget or premium? I tested both. Here's which is worth it.",
    product_count: "multi",
  },
  {
    angle_type: "stop_buying_x",
    emotional_trigger: "frustration with common mistakes, desire to avoid waste",
    persuasion_style: "Stop buying the wrong thing. Switch to the right one.",
    suggested_hook_structure: "Stop buying [X]. Switch to [Y] instead. Here's why.",
    product_count: "multi",
  },
  {
    angle_type: "top_3_tested",
    emotional_trigger: "trust in hands-on testing, curated shortlist",
    persuasion_style: "Top 3 tested. Honest ranking. Pick based on your needs.",
    suggested_hook_structure: "I tested the top 3. Here's my honest ranking.",
    product_count: "multi",
  },
  {
    angle_type: "best_under_price",
    emotional_trigger: "value-seeking, budget constraints",
    persuasion_style: "Best under £X. Price cap. No compromise on quality.",
    suggested_hook_structure: "Best under £[X]? I found it. Here's the winner.",
    product_count: "multi",
  },
];

/**
 * Get angles eligible for the given product count.
 * - Single product: standard conversion angles only (excludes vs_comparison, stack_duo)
 * - Multiple products: conversion + comparison-style angles enabled
 */
function getEligibleAngles(productCount: number): MarketingAngle[] {
  const hasMultipleProducts = productCount >= 2;
  return ANGLE_CATALOG.filter((a) => {
    if (a.product_count === "both") return true; // Standard conversion, works for any count
    if (a.product_count === "multi") return hasMultipleProducts; // Comparison-style: only when 2+ products
    if (a.product_count === "single") return !hasMultipleProducts; // Single-product only
    return false;
  });
}

/**
 * Randomly select N distinct angles. Filters by campaign product count:
 * - Single product: standard conversion angles only
 * - Multiple products: conversion + comparison-style angles (vs_comparison, stack_duo)
 *
 * @param count Number of angles to select
 * @param productCount 1 = single product, 2+ = multi-product campaign
 * @param preferredAngleType Optional. If provided and eligible, this angle is included first.
 */
export function selectDistinctAngles(
  count: number,
  productCount: number = 1,
  preferredAngleType?: string
): MarketingAngle[] {
  const eligible = getEligibleAngles(productCount);
  let result: MarketingAngle[] = [];
  if (preferredAngleType) {
    const preferred = eligible.find((a) => a.angle_type === preferredAngleType);
    if (preferred) {
      result = [preferred];
      const rest = eligible.filter((a) => a.angle_type !== preferredAngleType);
      const shuffled = [...rest].sort(() => Math.random() - 0.5);
      for (const a of shuffled) {
        if (result.length >= count) break;
        result.push(a);
      }
      return result;
    }
  }
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, eligible.length));
}
