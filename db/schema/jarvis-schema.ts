import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * Jarvis Phase 1 — AI execution assistant orchestration tables.
 *
 * execution_runs: one row per user goal ("Content Flywheel needs more
 * sales. Create content for this week."). Drives the live execution panel
 * and survives page refresh — the client always resumes from DB state,
 * never from in-memory state.
 *
 * execution_steps: one row per internal tool call within a run. Used both
 * for the live "Planning / Reading business memory / ..." panel and as an
 * audit log (every tool call's input/output/error is persisted).
 */

export type ExecutionRunStatus =
  | "queued"
  | "planning"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type ExecutionStepStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/**
 * Which approval screen "awaiting_approval" refers to.
 *   plan_review  — strategy has been produced, needs approval before spending
 *                  AI calls on generating assets.
 *   asset_review — assets have been generated, needs approval before saving
 *                  anything into the user's library.
 * Null once the run is completed/failed/cancelled, or while actively running.
 */
export type JarvisGate = "plan_review" | "asset_review" | null;

export const JARVIS_TOOL_NAMES = [
  "get_business_profile",
  "get_product_details",
  "get_brand_memory",
  "get_existing_content",
  "analyse_offer",
  "create_content_strategy",
  "generate_video_scripts",
  "generate_carousel_copy",
  "generate_email_campaign",
  "save_content_campaign",
] as const;

export type JarvisToolName = (typeof JARVIS_TOOL_NAMES)[number];

/* ─── Plan (strategy) shape — stored as JSON in execution_runs.plan ────────── */

export type MissingInfoQuestion = {
  key: string;
  question: string;
  placeholder?: string;
};

export type ContentAssetType = "video_script" | "carousel" | "email";

export type ContentStrategyAssetPlan = {
  assetType: ContentAssetType;
  count: number;
  angle: string;
  notes?: string;
};

export type OfferAnalysis = {
  strengths: string[];
  gaps: string[];
  recommendedAngles: string[];
  urgencyIdeas: string[];
};

export type JarvisPlan = {
  objectiveSummary: string;
  offerAnalysis: OfferAnalysis;
  assetPlan: ContentStrategyAssetPlan[];
  missingInfo: MissingInfoQuestion[];
  /** User-supplied answers to missingInfo questions, merged in before generation. */
  answers?: Record<string, string>;
  generatedAt: string;
};

/* ─── Proposed assets — stored as JSON array in execution_runs.assets ───────── */

export type ProposedAssetStatus = "proposed" | "approved" | "rejected" | "saved";

type ProposedAssetBase = {
  id: string;
  status: ProposedAssetStatus;
  /** Set to true once the user edits the AI-generated content. */
  edited: boolean;
  /** Set once save_content_campaign successfully persists this asset. */
  savedRefTable?: "scripts" | "email_campaigns";
  savedRefId?: string;
  /** Populated if saving this specific asset failed. */
  saveError?: string;
};

export type ProposedVideoScript = ProposedAssetBase & {
  type: "video_script";
  platform: string; // "tiktok" | "instagram" | "youtube" | ...
  title: string;
  hook: string;
  script: string;
  cta: string;
};

export type ProposedCarousel = ProposedAssetBase & {
  type: "carousel";
  platform: string; // "instagram" | "tiktok"
  title: string;
  slides: string[];
  caption: string;
  hashtags: string[];
};

export type ProposedEmail = ProposedAssetBase & {
  type: "email";
  name: string;
  subject: string;
  previewText: string;
  bodyHtml: string;
};

export type ProposedAsset = ProposedVideoScript | ProposedCarousel | ProposedEmail;

/* ─── Final summary — stored as JSON in execution_runs.final_summary ────────── */

export type JarvisFinalSummary = {
  completedAt: string;
  savedCounts: { videoScripts: number; carousels: number; emails: number };
  savedAssetIds: string[];
  /** Assets the user approved but that failed to save — reported honestly, never hidden. */
  failedAssetIds: string[];
  message: string;
};

/* ─── Tables ─────────────────────────────────────────────────────────────────── */

export const executionRunsTable = pgTable("execution_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  goal: text("goal").notNull(),
  status: text("status").$type<ExecutionRunStatus>().default("queued").notNull(),
  currentGate: text("current_gate").$type<JarvisGate>(),
  plan: jsonb("plan").$type<JarvisPlan | null>(),
  assets: jsonb("assets").$type<ProposedAsset[]>().default([]).notNull(),
  finalSummary: jsonb("final_summary").$type<JarvisFinalSummary | null>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const executionStepsTable = pgTable("execution_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").notNull(),
  toolName: text("tool_name").$type<JarvisToolName>().notNull(),
  status: text("status").$type<ExecutionStepStatus>().default("queued").notNull(),
  input: jsonb("input").$type<Record<string, unknown> | null>(),
  output: jsonb("output").$type<Record<string, unknown> | null>(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertExecutionRun = typeof executionRunsTable.$inferInsert;
export type SelectExecutionRun = typeof executionRunsTable.$inferSelect;
export type InsertExecutionStep = typeof executionStepsTable.$inferInsert;
export type SelectExecutionStep = typeof executionStepsTable.$inferSelect;
