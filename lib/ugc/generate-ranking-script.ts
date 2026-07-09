/**
 * UGC Lab — Structured ranking script generator.
 * Uses stored order_index from products. Driven by ranking-formats config.
 */

import { getRankBadge } from "./ranking-templates";
import { truncateToDuration } from "./generate-script-variations";
import { getRankingFormat } from "./ranking-formats";

export type ProductForRankingScript = {
  productName: string;
  role: "primary" | "comparison";
  orderIndex: number;
};

function applyTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return out;
}

function getTierLabel(format: { tier_labels?: string[] }, index: number, total: number): string {
  const labels = format.tier_labels ?? ["S", "A", "B", "C", "D"];
  const tierIndex = total - 1 - index;
  return labels[Math.min(tierIndex, labels.length - 1)] ?? String(index + 1);
}

/**
 * Generate a structured ranking script from products ordered by order_index.
 * Uses format config (script_template) when formatId provided. No hardcoded format logic.
 */
export function generateRankingScript(
  products: ProductForRankingScript[],
  durationSeconds: number,
  formatId?: string
): { fullScript: string; hookPreview: string } {
  if (products.length === 0) {
    return { fullScript: "", hookPreview: "" };
  }
  if (products.length === 1) {
    const p = products[0];
    const script = `I tested ${p.productName}. Here's my honest take: it delivers.`;
    return {
      fullScript: truncateToDuration(script, durationSeconds),
      hookPreview: `I tested ${p.productName}.`,
    };
  }

  const ordered = [...products].sort((a, b) => a.orderIndex - b.orderIndex);
  const format = formatId ? getRankingFormat(formatId) : undefined;
  const tpl = format?.script_template;

  const parts: string[] = [];

  if (tpl) {
    parts.push(tpl.intro);
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      const rank = i + 1;
      const badge = getRankBadge(i);
      const tier = getTierLabel(format!, i, ordered.length);
      if (p.role === "primary") {
        parts.push(applyTemplate(tpl.winnerLine, { NAME: p.productName, RANK: rank, BADGE: badge, TIER: tier }));
      } else {
        parts.push(applyTemplate(tpl.rankLine, { NAME: p.productName, RANK: rank, BADGE: badge, TIER: tier }));
      }
    }
    parts.push(tpl.outro);
  } else {
    parts.push(`I tested ${ordered.map((p) => p.productName).join(", ")}.`);
    parts.push("Here's my honest ranking.");
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      const badge = getRankBadge(i);
      if (p.role === "primary") {
        parts.push(`And the winner: ${p.productName}.`);
      } else {
        parts.push(`Coming in at ${badge}: ${p.productName}.`);
      }
    }
    parts.push("Save yourself the research.");
  }

  const fullScript = truncateToDuration(parts.join(" "), durationSeconds);
  const hookPreview = tpl ? tpl.intro : `I tested ${ordered.length} products. Here's my ranking.`;

  return { fullScript, hookPreview };
}
