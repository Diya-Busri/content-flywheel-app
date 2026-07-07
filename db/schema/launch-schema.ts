import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

export type LaunchStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed";
export type LaunchStageId = "research" | "product" | "design" | "marketing" | "store" | "complete";

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
    /** Complete synthesis report — used by Product, Design, Marketing agents */
    fullReport?: Record<string, unknown>;
  };
  product?: {
    productId: string;
    productName: string;
  };
  design?: {
    /** Product Cover — portrait marketing image */
    coverUrl?: string;
    /** 3D Mockup — product on desk scene */
    mockupUrl?: string;
    /** Store Thumbnail — square listing image */
    thumbnailUrl?: string;
    /** Social Preview — square promo image */
    socialUrl?: string;
    /** How many assets were successfully generated */
    assetsCount?: number;
  };
  video?: {
    libraryScriptId: string;
  };
  marketing?: {
    posts: string[];
    emailSubject: string;
    hashtags: string[];
  };
  store?: {
    productId: string;
    storeUrl?: string;
    publishedAt?: string;
  };
};

export const launchProjectsTable = pgTable("launch_projects", {
  id:           uuid("id").defaultRandom().primaryKey(),
  userId:       text("user_id").notNull(),
  goal:         text("goal").notNull(),
  status:       text("status").$type<LaunchStatus>().default("queued").notNull(),
  currentStage: text("current_stage").$type<LaunchStageId>().default("research").notNull(),
  progress:     integer("progress").default(0).notNull(),
  memory:       jsonb("memory").$type<LaunchMemory>(),
  stageResults: jsonb("stage_results").$type<LaunchStageResults>(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
