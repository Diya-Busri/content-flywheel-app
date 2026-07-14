/**
 * Credit costs for each MG Agent tool step.
 *
 * Change costs here — all routes pick them up automatically.
 * Steps with cost = 0 make no provider calls (DB-only) and deduct nothing.
 */

import type { MgToolName } from "./agent-types";

export const MG_TOOL_CREDIT_COSTS: Record<MgToolName, number> = {
  mg_source_analyst:     1,  // gpt-4o-mini — fast analysis
  mg_content_strategist: 1,  // gpt-4o-mini — angle + hook options
  mg_script_agent:       3,  // gpt-4o      — full script
  mg_storyboard_agent:   2,  // gpt-4o-mini — 5-scene storyboard
  mg_save_agent:         0,  // DB-only — no AI, no charge
};

/** Total credits charged across a full run (all paid steps). */
export function totalMgRunCreditCost(): number {
  return Object.values(MG_TOOL_CREDIT_COSTS).reduce((a, b) => a + b, 0);
}

/**
 * Credits shown to the user at plan approval time.
 * Excludes save_agent (free) and the two analysis steps already run.
 */
export function remainingCreditCostAfterApproval(): number {
  return (
    MG_TOOL_CREDIT_COSTS.mg_script_agent +
    MG_TOOL_CREDIT_COSTS.mg_storyboard_agent
  );
}
