import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export type LaunchStatus = "running" | "awaiting_approval" | "completed" | "failed";
export type LaunchStageId = "research" | "product" | "design" | "video" | "marketing" | "complete";

export type LaunchMemory = {
  audience?: string;
  niche?: string;
  productName?: string;
  query?: string;
  priceRange?: string;
  format?: string;
};

export type LaunchStageResults = {
  research?: {
    insights: string[];
    query: string;
    reportSummary?: string;
    productOpportunities?: Array<{ title: string; description: string; type: string; priceRange: string }>;
    keywords?: Array<{ term: string; intent: string; opportunity: string; note: string }>;
    actionPlan?: Array<{ step: number; action: string; detail: string; cta?: string }>;
    competitorInsights?: Array<{ name: string; strength: string; gap: string }>;
  };
  product?: {
    productId: string;
    productName: string;
  };
  design?: {
    bundleId: string;
  };
  video?: {
    libraryScriptId: string;
  };
  marketing?: {
    posts: string[];
    emailSubject: string;
    hashtags: string[];
  };
};

export const launchProjectsTable = pgTable("launch_projects", {
  id:           uuid("id").defaultRandom().primaryKey(),
  userId:       text("user_id").notNull(),
  goal:         text("goal").notNull(),
  status:       text("status").$type<LaunchStatus>().default("running").notNull(),
  currentStage: text("current_stage").$type<LaunchStageId>().default("research").notNull(),
  memory:       jsonb("memory").$type<LaunchMemory>(),
  stageResults: jsonb("stage_results").$type<LaunchStageResults>(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
