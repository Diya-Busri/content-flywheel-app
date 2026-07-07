/**
 * Shared types for the AI Execution pipeline agent system.
 *
 * Architecture:
 *   Each stage in PIPELINE_STAGES has an `execute` slot typed as:
 *     ((ctx: ExecutionContext) => Promise<void>) | null
 *
 *   Phases 1.2+ fill each slot with a real agent function.
 *   The execution page never needs to know what's inside the agent —
 *   it only reads AgentStep[] and progress updates via callbacks.
 */

import type { LaunchStageId, LaunchStatus, LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Step ─────────────────────────────────────────────────────────────────── */

export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentStep {
  id:     string;
  label:  string;
  status: AgentStepStatus;
}

/* ─── Callbacks ─────────────────────────────────────────────────────────────── */

export interface AgentCallbacks {
  /**
   * Called whenever the agent's internal step list changes.
   * The page renders these as live checklist items inside the active agent card.
   */
  onStep: (steps: AgentStep[]) => void;

  /**
   * Reports agent-internal progress 0–100.
   * The execution page maps this into the stage's slice of overall pipeline progress.
   * e.g. Research = 0–20% overall, so agent reporting 50% → 10% overall.
   */
  onProgress: (pct: number, label: string) => void;
}

/* ─── Save patch ─────────────────────────────────────────────────────────────── */

export interface SaveProgressPatch {
  currentStage?:  LaunchStageId;
  /** Overall 0–100 (already mapped by the page before calling saveProgress) */
  progress?:      number;
  status?:        LaunchStatus;
  stageResults?:  Partial<LaunchStageResults>;
}

/* ─── Context passed to every agent ──────────────────────────────────────────── */

export interface ExecutionContext {
  /** DB row id */
  launchId:     string;
  /** The raw goal the user typed */
  goal:         string;
  /** Latest persisted results from all stages so far */
  stageResults: LaunchStageResults;
  /** UI callbacks — never call these after the agent resolves */
  callbacks:    AgentCallbacks;
  /**
   * Persist a progress patch to DB and update local state.
   * Agents call this once when they finish their stage.
   */
  saveProgress: (patch: SaveProgressPatch) => Promise<void>;
}

/* ─── Agent status (used by the execution page per-card) ─────────────────────── */

export type AgentStatus = "waiting" | "working" | "complete" | "error";
