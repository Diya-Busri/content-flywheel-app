import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

export type LaunchStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed";

/* ─── Business Brain types ───────────────────────────────────────────────────── */

export type BrainSectionBase = {
  score:   number;
  summary: string;
};

export type BrainRecommendation = {
  id:          string;
  priority:    "high" | "medium" | "low";
  category:    "product" | "design" | "store" | "marketing" | "pricing";
  title:       string;
  /** What specifically to do — referencing actual content from the project */
  detail:      string;
  /** Why — grounded in specific data from the project */
  reasoning:   string;
  /** Qualitative impact description — no invented percentages */
  impact?:     string;
  confidence:  "high" | "medium" | "low";
  actionType:  "edit_product" | "edit_store" | "regenerate_design" | "edit_marketing" | "manual";
  actionHref?: string;
};

export type BrainResult = {
  businessScore:  number;
  launchScore:    number;
  reviewSummary:  string;
  sections: {
    marketOpportunity: BrainSectionBase & { insights: string[] };
    product:           BrainSectionBase & { strengths: string[]; issues: string[] };
    design:            BrainSectionBase & { issues: string[] };
    store:             BrainSectionBase & { issues: string[] };
    marketing:         BrainSectionBase & { issues: string[] };
    launchReadiness:   { score: number; explanation: string };
  };
  recommendations: BrainRecommendation[];
  completedAt:     string;
};
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
    /** ISO timestamp when this stage completed */
    completedAt?: string;
  };
  product?: {
    productId: string;
    productName: string;
    /** ISO timestamp when this stage completed */
    completedAt?: string;
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
    /** ISO timestamp when this stage completed */
    completedAt?: string;
  };
  video?: {
    libraryScriptId: string;
  };
  marketing?: {
    /* ── Launch Campaign ── */
    salesCopy?: {
      headline:    string;
      subheadline: string;
      body:        string;
    };
    marketplaceDesc?:   string;
    storeDesc?:         string;
    seoTitle?:          string;
    seoMetaDesc?:       string;
    tags?:              string[];
    launchAnnouncement?: string;
    faq?:               Array<{ q: string; a: string }>;
    ctas?:              string[];
    headlines?:         string[];
    /* ── Social Media ── */
    carousels?:         Array<{ hook: string; slides: string[] }>;
    tiktokHooks?:       string[];
    xPosts?:            string[];
    instagramCaptions?: string[];
    /* ── Email Marketing ── */
    emails?: Array<{
      name:    string;
      subject: string;
      preview: string;
      body:    string;
    }>;
    /* Legacy fields (kept for backwards compat) */
    posts?:        string[];
    emailSubject?: string;
    hashtags?:     string[];
    /** ISO timestamp when this stage completed */
    completedAt?: string;
  };
  store?: {
    productId:       string;
    storeUrl?:       string;
    readinessScore?: number;
    validationChecks?: Array<{
      id:      string;
      label:   string;
      status:  "ok" | "fixed" | "warning" | "missing";
      detail?: string;
    }>;
    publishedAt?: string;
    /** ISO timestamp when this stage completed */
    completedAt?: string;
  };
  /**
   * Growth Mode — daily AI operational check.
   * Stores goal, health report, AI tasks, and feed items.
   * Updated by POST /api/projects/[launchId]/growth-check.
   */
  growth?: GrowthData;
  /**
   * Business Memory — permanent knowledge base for this project.
   * Auto-updated every time a worker runs or analysis completes.
   * Injected into every AI prompt so each generation is smarter than the last.
   * Users can view and edit any fact at /dashboard/projects/[launchId]/memory.
   */
  memory?: BusinessMemory;
  /**
   * Mission Control — CEO AI that coordinates the workforce daily.
   * Generates a strategic plan with specific task assignments for workers.
   * Updated by POST /api/projects/[launchId]/mission-control/run.
   */
  missionControl?: MissionControlData;
  /**
   * AI Workforce — 6 persistent workers that own ongoing responsibilities.
   * Each worker reads existing project data, executes targeted micro-tasks,
   * and appends results to the relevant stageResults field.
   * Never regenerates from scratch — always improves existing assets.
   */
  workforce?: WorkforceData;
  /**
   * Business Brain — post-pipeline founder review.
   * Auto-generated when workspace first loads after completion.
   * Critiques all pipeline output and surfaces prioritised recommendations.
   */
  brain?: BrainResult;
  /**
   * Optional post-pipeline content pack — "Behind the Build".
   * Not a pipeline stage. Generated on demand by the creator.
   * Never auto-published. Stores 5 authentic creator content pieces.
   */
  behindTheBuild?: {
    items: Array<{
      /** Unique piece ID: "tiktok" | "instagram" | "linkedin" | "x" | "story" */
      id:      string;
      label:   string;
      emoji:   string;
      content: string;
    }>;
    /** ISO timestamp when this pack was generated */
    generatedAt: string;
  };
};

/* ─── Growth Mode types ──────────────────────────────────────────────────────── */

export type ProjectGoal = {
  type:    "first_sale" | "10_sales" | "100_customers" | "100_revenue" | "1000_revenue" | "1000_visitors" | "custom";
  label:   string;
  target:  number;
  current: number;
  unit:    "sales" | "customers" | "revenue_gbp" | "visitors";
};

export type GrowthCheck = {
  id:      string;
  label:   string;
  status:  "ok" | "warning" | "missing";
  detail?: string;
};

export type GrowthAITask = {
  id:          string;
  category:    "content" | "seo" | "store" | "marketing" | "product" | "analysis";
  title:       string;
  detail:      string;
  priority:    "high" | "medium" | "low";
  /** pending = not yet acted on; done/skipped = user resolved */
  status:      "pending" | "done" | "skipped";
  actionHref?: string;
  createdAt:   string;
};

export type GrowthFeedItem = {
  id:        string;
  emoji:     string;
  text:      string;
  detail?:   string;
  href?:     string;
  category:  "insight" | "content" | "competitor" | "seo" | "store" | "improvement";
  timestamp: string;
};

export type GrowthReport = {
  healthScore: number;
  summary:     string;
  checks:      GrowthCheck[];
  nextAction:  { label: string; href: string; priority: "high" | "medium" | "low" };
  generatedAt: string;
};

export type GrowthData = {
  goal?:          ProjectGoal;
  report?:        GrowthReport;
  aiTasks?:       GrowthAITask[];
  feed?:          GrowthFeedItem[];
  lastCheckedAt?: string;
};

/* ─── AI Workforce types ─────────────────────────────────────────────────────── */

export type WorkerId =
  | "research"
  | "product"
  | "design"
  | "marketing"
  | "store"
  | "growth";

export type WorkerActivity = {
  id:           string;
  label:        string;
  detail?:      string;
  /** Number of new assets added to stageResults (hooks, keywords, etc.) */
  assetsAdded?: number;
  completedAt:  string;
};

export type WorkerState = {
  /** User has paused this worker — it won't auto-run */
  isPaused:       boolean;
  /** Currently executing — guard against double-run */
  isRunning:      boolean;
  /** ISO of last run */
  lastRunAt?:     string;
  /** Human-readable description of what it's doing / last did */
  currentTask?:   string;
  /** What it plans to do on next run (derived from state) */
  nextTask?:      string;
  /** Most recent completed activity */
  lastActivity?:  WorkerActivity;
  /** Chronological log — newest first, capped at 20 */
  history:        WorkerActivity[];
  /** Design worker: queued briefs the user hasn't generated yet */
  designBriefs?: Array<{
    id:          string;
    type:        "thumbnail" | "social" | "cover" | "mockup";
    description: string;
    style:       string;
    queuedAt:    string;
  }>;
  /** Product worker: improvement suggestions */
  productSuggestions?: Array<{
    id:       string;
    area:     string;
    priority: "high" | "medium" | "low";
    detail:   string;
    addedAt:  string;
  }>;
};

export type WorkforceData = {
  workers: Partial<Record<WorkerId, WorkerState>>;
};

/* ─── Business Memory types ──────────────────────────────────────────────────── */

export type MemoryCategory =
  | "brand"
  | "audience"
  | "products"
  | "marketing"
  | "launches"
  | "analytics"
  | "ideas"
  | "lessons"
  | "knowledge";

export type MemoryFact = {
  id:              string;
  category:        MemoryCategory;
  /** Stable machine key, e.g. "target_audience", "top_keywords" */
  key:             string;
  /** Human-readable label shown in the Memory Viewer */
  label:           string;
  value:           string;
  /** Where this fact came from */
  source:          string; // "auto" | "brain" | "mission_control" | "user" | "worker:marketing" etc.
  confidence:      "high" | "medium" | "low";
  /** User explicitly confirmed or wrote this — never auto-overwritten */
  confirmedByUser: boolean;
  addedAt:         string;
  updatedAt:       string;
};

export type MemorySuggestion = {
  id:          string;
  category:    MemoryCategory;
  key:         string;
  label:       string;
  value:       string;
  source:      string;
  /** Why the AI thinks this is worth remembering */
  reason:      string;
  suggestedAt: string;
};

export type BusinessMemory = {
  facts:              MemoryFact[];
  suggestions?:       MemorySuggestion[];
  lastExtractedAt?:   string;
};

/* ─── Mission Control types ──────────────────────────────────────────────────── */

export type MissionFocus =
  | "launch"
  | "growth"
  | "optimisation"
  | "scaling"
  | "maintenance";

export type MissionTask = {
  id:           string;
  workerId:     WorkerId;
  workerLabel:  string;
  /** The specific instruction passed to the worker when it runs */
  instruction:  string;
  reason:       string;
  priority:     "high" | "medium" | "low";
  status:       "pending" | "running" | "done" | "skipped";
  assignedAt:   string;
  completedAt?: string;
};

export type MissionPlan = {
  id:               string;
  /** YYYY-MM-DD of the day this plan was generated */
  date:             string;
  focus:            MissionFocus;
  focusReason:      string;
  mission:          string;
  missionReason:    string;
  tasks:            MissionTask[];
  estimatedImpact:  string;
  estimatedMinutes: number;
  generatedAt:      string;
};

export type MissionBriefing = {
  /** Opening sentence */
  greeting:         string;
  /** What completed since last brief */
  yesterday:        string[];
  /** Today's strategic direction */
  today:            string[];
  estimatedMinutes: number;
  date:             string;
};

export type MissionMemory = {
  acceptedRecommendations: string[];
  rejectedRecommendations: string[];
  currentBottlenecks:      string[];
  lastUpdated:             string;
};

export type MissionControlData = {
  focus?:       MissionFocus;
  currentPlan?: MissionPlan;
  briefing?:    MissionBriefing;
  memory?:      MissionMemory;
  /** Last 7 daily plans, newest first */
  planHistory?: MissionPlan[];
  lastRunAt?:   string;
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
