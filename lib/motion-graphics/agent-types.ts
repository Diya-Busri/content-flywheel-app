/**
 * Motion Graphics Agent Workflow — canonical types.
 *
 * All server modules (run-store, tools, API routes) and client modules
 * (hook, panel) import from here. Never import from jarvis-schema for
 * MG types — the MG workflow is a separate execution system.
 */

import type { ContentMode, CfMentionMode, AspectRatio, ShortFormOutput } from "./types";

// ─── Run status ───────────────────────────────────────────────────────────────

export type MgRunStatus =
  | "queued"
  | "analysing"
  | "strategising"
  | "awaiting_plan_approval"
  | "scripting"
  | "storyboarding"
  | "awaiting_storyboard_approval"
  | "saving"
  | "completed"
  | "failed"
  | "cancelled";

/** Gate type: which approval screen the run is paused at. */
export type MgGate = "plan_review" | "storyboard_review" | null;

export type MgStepStatus = "queued" | "running" | "completed" | "failed" | "skipped";

/** Statuses in which the run is actively processing (poll during these). */
export const MG_ACTIVE_STATUSES = new Set<MgRunStatus>([
  "queued",
  "analysing",
  "strategising",
  "scripting",
  "storyboarding",
  "saving",
]);

/** Statuses in which the run is waiting for user action. */
export const MG_GATE_STATUSES = new Set<MgRunStatus>([
  "awaiting_plan_approval",
  "awaiting_storyboard_approval",
]);

/** Terminal statuses — do not poll. */
export const MG_TERMINAL_STATUSES = new Set<MgRunStatus>([
  "completed",
  "failed",
  "cancelled",
]);

// ─── Tool names ───────────────────────────────────────────────────────────────

export type MgToolName =
  | "mg_source_analyst"
  | "mg_content_strategist"
  | "mg_script_agent"
  | "mg_storyboard_agent"
  | "mg_save_agent";

// ─── MG tool context and interface ───────────────────────────────────────────

export type MgToolContext = {
  userId: string;
  runId: string;
};

import type { z } from "zod";

export type ToolSuccess<T> = { success: true; data: T };
export type ToolFailure = { success: false; error: string };
export type MgToolResult<T> = ToolSuccess<T> | ToolFailure;

export function mgOk<T>(data: T): MgToolResult<T> {
  return { success: true, data };
}

export function mgFail(error: string): MgToolResult<never> {
  return { success: false, error };
}

export interface MgTool<TInput = unknown, TOutput = unknown> {
  name: MgToolName;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (ctx: MgToolContext, input: TInput) => Promise<MgToolResult<TOutput>>;
}

// ─── Plan shape (stored on mg_runs.plan) ─────────────────────────────────────

export type MgCfIntegrationLevel = "off" | "subtle" | "direct";

/** Source Analyst output — embedded in MgPlan. */
export interface MgSourceAnalysis {
  coreProblem: string;
  emotionalAngle: string;
  audience: string;
  /** The most compelling quote / sentence from the source. Never invented. */
  strongestQuote: string;
  keyInsight: string;
  missingContext: string;
}

/**
 * Content strategy plan.
 * Stored on mg_runs.plan. Editable by user at plan_review gate.
 * Used as source of truth for script + storyboard generation.
 */
export interface MgPlan {
  /** From source analyst — read-only at plan review */
  analysis: MgSourceAnalysis;
  /** Recommended content angle — user can edit before approving */
  recommendedAngle: string;
  /** 3 hook options produced by AI — user picks or edits one */
  hookOptions: string[];
  /** The hook that will be used — initially hookOptions[0], user can change */
  selectedHook: string;
  /** Main lesson / takeaway for the viewer */
  mainLesson: string;
  /** Suggested call to action */
  suggestedCta: string;
  /** CF mention level to use during generation */
  cfIntegrationLevel: MgCfIntegrationLevel;
  /** Content deliverables to produce (v1: always ["short-form-video"]) */
  deliverables: string[];
  /** Estimated scene count */
  estimatedScenes: number;
  /** Estimated total credit cost for the paid steps */
  estimatedCreditCost: number;
  /** Repurposing options (all "coming soon" in v1) */
  repurposingOptions: string[];
}

// ─── Run and step shapes ──────────────────────────────────────────────────────

export interface MgRun {
  id: string;
  userId: string;
  /** Set once the project has been saved. */
  projectId?: string;
  contentMode: ContentMode;
  sourceText: string;
  sourceUrl?: string;
  targetAudience?: string;
  mainOpinion?: string;
  desiredCta?: string;
  cfMention: CfMentionMode;
  videoDuration?: string;
  tone?: string;
  aspectRatio: AspectRatio;
  status: MgRunStatus;
  currentGate: MgGate;
  /** Content strategy plan — present once strategising completes. */
  plan?: MgPlan;
  /** Approved storyboard — present once storyboarding completes. */
  shortForm?: ShortFormOutput;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MgStep {
  id: string;
  runId: string;
  toolName: MgToolName;
  attemptNumber: number;
  status: MgStepStatus;
  /** Minimal diagnostic info — does NOT include full source_text. */
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MgRunWithSteps extends MgRun {
  steps: MgStep[];
}

// ─── Plan approval editable fields ───────────────────────────────────────────

/** Fields the user can change at the plan review gate. */
export interface MgPlanEdits {
  recommendedAngle?: string;
  selectedHook?: string;
  mainLesson?: string;
  suggestedCta?: string;
  cfIntegrationLevel?: MgCfIntegrationLevel;
  deliverables?: string[];
}

// ─── UI step labels ───────────────────────────────────────────────────────────

export interface MgUiStep {
  label: string;
  toolName?: MgToolName;
  isGate?: boolean;
  gateType?: MgGate;
}

export const MG_UI_STEPS: MgUiStep[] = [
  { label: "Analysing source",   toolName: "mg_source_analyst" },
  { label: "Choosing angle",     toolName: "mg_content_strategist" },
  { label: "Plan approval",      isGate: true, gateType: "plan_review" },
  { label: "Writing script",     toolName: "mg_script_agent" },
  { label: "Building storyboard", toolName: "mg_storyboard_agent" },
  { label: "Storyboard approval", isGate: true, gateType: "storyboard_review" },
  { label: "Saving project",     toolName: "mg_save_agent" },
  { label: "Complete",           isGate: true },
];
