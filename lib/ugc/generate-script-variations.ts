/**
 * UGC Lab — Generate 3–5 script variations for batch video generation.
 * Uses angle-engine to select distinct marketing angles, then generates scripts
 * with that angle context. Scripts dynamically reference product names and respect duration limits.
 */

import { selectDistinctAngles, type MarketingAngle } from "./angle-engine";

/** ~2.6 words per second for natural speech. Slightly generous for fuller scripts. */
const WORDS_PER_SECOND = 2.6;

export type CampaignProduct = {
  productName: string;
  role: "primary" | "comparison";
  orderIndex?: number;
};

/** Truncate script to fit within duration (seconds). */
export function truncateToDuration(text: string, durationSeconds: number): string {
  const maxWords = Math.floor(durationSeconds * WORDS_PER_SECOND);
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").trim();
}

/** Inject product names into script. Uses {{PRIMARY}}, {{COMPARISON_LIST}}, {{ALL_PRODUCTS}}. */
export function injectProductNames(
  text: string,
  products: CampaignProduct[]
): string {
  if (!products?.length) return text;
  const primary = products.find((p) => p.role === "primary");
  const comparison = products.filter((p) => p.role === "comparison");
  const primaryName = primary?.productName ?? "this product";
  const comparisonNames = comparison.map((p) => p.productName);
  const allNames = products
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((p) => p.productName);
  const comparisonList =
    comparisonNames.length === 0
      ? primaryName
      : comparisonNames.length === 1
        ? comparisonNames[0]
        : comparisonNames.slice(0, -1).join(", ") + " and " + comparisonNames[comparisonNames.length - 1];
  const allList =
    allNames.length <= 1
      ? allNames[0] ?? primaryName
      : allNames.slice(0, -1).join(", ") + " and " + allNames[allNames.length - 1];

  return text
    .replace(/\{\{PRIMARY\}\}/g, primaryName)
    .replace(/\{\{COMPARISON_LIST\}\}/g, comparisonList)
    .replace(/\{\{ALL_PRODUCTS\}\}/g, allList)
    .replace(/\{\{COMPARISON_1\}\}/g, comparisonNames[0] ?? primaryName)
    .replace(/\{\{COMPARISON_2\}\}/g, comparisonNames[1] ?? comparisonNames[0] ?? primaryName)
    .replace(/\{\{COMPARISON_3\}\}/g, comparisonNames[2] ?? comparisonNames[1] ?? primaryName);
}

export type ScriptVariation = {
  fullScript: string;
  hookPreview: string;
  angle?: MarketingAngle; // Angle context used (for debugging / future AI)
};

/** Build prompt-ready angle context for AI script generation. */
export function getAngleContextForPrompt(angle: MarketingAngle): string {
  return [
    `Angle type: ${angle.angle_type}`,
    `Emotional trigger: ${angle.emotional_trigger}`,
    `Persuasion style: ${angle.persuasion_style}`,
    `Suggested hook structure: ${angle.suggested_hook_structure}`,
  ].join("\n");
}

/** Mock script templates keyed by angle_type. Use {{PRIMARY}} for product name injection. */
const SCRIPT_BY_ANGLE: Record<string, Omit<ScriptVariation, "angle">> = {
  pain_focused: {
    hookPreview: "Tired of wasting money on stuff that doesn't work?",
    fullScript:
      "Tired of wasting money on stuff that doesn't work? I was stuck in the same loop—buy, disappoint, repeat. Then I found {{PRIMARY}}. It actually delivers. No more guessing. If you're frustrated like I was, {{PRIMARY}} is your fix.",
  },
  desire_lifestyle: {
    hookPreview: "Imagine finally having that thing you've been putting off.",
    fullScript:
      "Imagine finally having that thing you've been putting off. Picture your life with {{PRIMARY}}—easier mornings, better results, less stress. It made it real for me. It's not a maybe anymore. Your future self will thank you.",
  },
  objection_handling: {
    hookPreview: "I know what you're thinking—another hyped product?",
    fullScript:
      "I know what you're thinking—another hyped product? I thought the same. Too good to be true, right? I tested {{PRIMARY}}. No BS. The results were real. If you're skeptical like I was, give it one try. You'll get it.",
  },
  social_proof: {
    hookPreview: "Everyone in my feed is obsessed with {{PRIMARY}}. Now I get it.",
    fullScript:
      "Everyone in my feed is obsessed with {{PRIMARY}}. Now I get it. I finally tried it and—okay, they were right. The hype is real. Don't be the last one to figure it out. Join us.",
  },
  authority_comparison: {
    hookPreview: "I've tried everything in this category. Nothing else comes close.",
    fullScript:
      "I've tried everything in this category. Nothing else comes close. I'm picky. I compare. And {{PRIMARY}} wins. The difference is obvious once you use it. If you want the best, skip the rest.",
  },
  before_after: {
    hookPreview: "Before {{PRIMARY}}, I was stuck. Now everything's different.",
    fullScript:
      "Before {{PRIMARY}}, I was stuck. Now everything's different. I didn't believe it would work either—until I saw the change. Real results, real fast. Your turn.",
  },
  urgency_scarcity: {
    hookPreview: "{{PRIMARY}} won't be around forever. I'm glad I didn't wait.",
    fullScript:
      "{{PRIMARY}} won't be around forever. I'm glad I didn't wait. I almost skipped it. Best decision I made. If you're on the fence, don't. Get it before it's gone.",
  },
  vs_comparison: {
    hookPreview: "I compared {{COMPARISON_LIST}}. Here's which one actually wins.",
    fullScript:
      "I compared {{ALL_PRODUCTS}}. Here's which one actually wins. I tested them all. The difference is obvious. Save yourself the guesswork—{{PRIMARY}} is the one.",
  },
  stack_duo: {
    hookPreview: "{{COMPARISON_LIST}} together? Game changer.",
    fullScript:
      "{{ALL_PRODUCTS}} together? Game changer. I was using them separately. Then I stacked them. Completely different results. Here's why.",
  },
  ranking_style: {
    hookPreview: "I ranked {{ALL_PRODUCTS}}. Here's my #1 pick.",
    fullScript:
      "I ranked {{ALL_PRODUCTS}}. Here's my honest #1 pick: {{PRIMARY}}. Why? Because it delivers where others fall short. Save yourself the research.",
  },
  budget_vs_premium: {
    hookPreview: "Budget or premium? I tested {{ALL_PRODUCTS}}.",
    fullScript:
      "Budget or premium? I tested {{ALL_PRODUCTS}}. Here's which is worth it: {{PRIMARY}}. The rest? Save your money or splurge smarter.",
  },
  stop_buying_x: {
    hookPreview: "Stop buying the wrong one. Switch to {{PRIMARY}}.",
    fullScript:
      "Stop buying {{COMPARISON_1}}. Switch to {{PRIMARY}} instead. I made the switch. The difference is night and day. Here's why.",
  },
  top_3_tested: {
    hookPreview: "I tested the top 3. Here's my honest ranking.",
    fullScript:
      "I tested {{ALL_PRODUCTS}}. Here's my honest ranking. Number one: {{PRIMARY}}. The rest? Depends on your needs. Full breakdown.",
  },
  best_under_price: {
    hookPreview: "Best under your budget? {{PRIMARY}} wins.",
    fullScript:
      "Best value in this category? I tested {{ALL_PRODUCTS}}. {{PRIMARY}} wins. No compromise on quality. Here's why it's the one.",
  },
};

export type HookOptions = {
  hookStyle?: string;
  tone?: string;
};

export type ScriptGenerationOptions = {
  products?: CampaignProduct[];
  durationSeconds?: number;
};

/**
 * Generate script variations. Scripts reference product names and respect duration limit.
 * @param productContext Fallback product name when no campaign products (single-product mode)
 * @param productCount 1 = single product, 2+ = multi-product (enables comparison angles)
 * @param hookOptions Optional. hookStyle = preferred angle_type; tone for future AI prompts.
 * @param scriptOptions Optional. products = campaign products; durationSeconds = max script length.
 */
export function generateScriptVariations(
  productContext?: string,
  count: number = 4,
  productCount: number = 1,
  hookOptions?: HookOptions,
  scriptOptions?: ScriptGenerationOptions
): ScriptVariation[] {
  const preferredAngle = hookOptions?.hookStyle?.trim() || undefined;
  const angles = selectDistinctAngles(count, productCount, preferredAngle);
  const products = scriptOptions?.products?.length
    ? scriptOptions.products
    : [{ productName: productContext?.trim() || "this product", role: "primary" as const }];
  const durationSeconds = scriptOptions?.durationSeconds ?? 30;

  return angles.map((angle) => {
    const template = SCRIPT_BY_ANGLE[angle.angle_type] ?? {
      hookPreview: angle.suggested_hook_structure,
      fullScript: `${angle.suggested_hook_structure} ${angle.persuasion_style}`,
    };
    let fullScript = injectProductNames(template.fullScript, products);
    let hookPreview = injectProductNames(template.hookPreview, products);
    fullScript = truncateToDuration(fullScript, durationSeconds);
    return { fullScript, hookPreview, angle };
  });
}

/**
 * Generate a single script for a given angle type. Used for "Regenerate Script (keep same angle)".
 * Applies product injection and duration truncation when options provided.
 */
export function generateScriptForAngle(
  angleType: string,
  productContext?: string,
  scriptOptions?: ScriptGenerationOptions
): Omit<ScriptVariation, "angle"> {
  const template = SCRIPT_BY_ANGLE[angleType] ?? SCRIPT_BY_ANGLE.pain_focused!;
  const products = scriptOptions?.products?.length
    ? scriptOptions.products
    : [{ productName: productContext?.trim() || "this product", role: "primary" as const }];
  const durationSeconds = scriptOptions?.durationSeconds ?? 30;
  let fullScript = injectProductNames(template.fullScript, products);
  let hookPreview = injectProductNames(template.hookPreview, products);
  fullScript = truncateToDuration(fullScript, durationSeconds);
  return { fullScript, hookPreview };
}
