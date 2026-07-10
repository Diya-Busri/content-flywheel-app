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
  /**
   * Whether this fix can be applied automatically by re-running the relevant AI agent.
   * true  = AI re-runs the stage with fixInstruction as extra context
   * false = requires the user to manually make changes
   */
  automatable:     boolean;
  /**
   * Which pipeline stage to re-run when applying this fix automatically.
   * Downstream stages re-run automatically (e.g. fixing "design" also re-runs marketing + store).
   */
  stage?:          "research" | "product" | "design" | "marketing" | "store";
  /**
   * Specific instruction passed to the agent when re-running this stage.
   * Tells the agent exactly what to improve, e.g. "Add a chapter on international students".
   */
  fixInstruction?: string;
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

/* ─── Asset validation types ─────────────────────────────────────────────────── */

export type AssetCheck = {
  id:       string;
  label:    string;
  /** If true, failing this check blocks "Ready to Launch" */
  required: boolean;
  status:   "pass" | "fail" | "warn";
  /** Human-readable explanation of why this check failed or what's missing */
  reason?:  string;
};

export type StageValidation = {
  /** overall stage status based on required checks */
  status:        "validated" | "needs_attention" | "failed";
  passedCount:   number;
  totalCount:    number;
  /** how many required checks passed */
  requiredPass:  number;
  /** how many required checks total */
  requiredTotal: number;
  checks:        AssetCheck[];
  validatedAt:   string;
};

export type LaunchMemory = {
  audience?: string;
  niche?: string;
  productName?: string;
  query?: string;
  priceRange?: string;
  format?: string;
};

/** User-supplied generation preferences collected on the goal input page */
export type LaunchPreferences = {
  /** Product length: controls numChapters (short=4, medium=6, long=9) and contentLength */
  productLength: "short" | "medium" | "long";
  /** Whether to include an AI-generated image prompt for each product page */
  includeImages: boolean;
  /** Number of Instagram carousel posts to generate */
  carouselCount: 3 | 5 | 8 | 10;
};

export type LaunchStageResults = {
  /** User preferences captured at launch start — read by product + design agents */
  preferences?: LaunchPreferences;
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
    /** Asset validation result — written by the agent immediately after generation */
    validation?: StageValidation;
  };
  product?: {
    productId: string;
    productName: string;
    /** Product format chosen by AI (e.g. "ebook", "guide", "course") */
    format?: string;
    /** Price point chosen by AI (e.g. "£27") */
    pricePoint?: string;
    /** How many sections had non-empty content after generation */
    sectionsGenerated?: number;
    /** Total sections in the outline */
    totalSections?: number;
    /** Sections with empty body content (generation failed or timed out) */
    emptySections?: number;
    /** True when the product row was confirmed inserted in the DB */
    savedToDb?: boolean;
    /** ISO timestamp when this stage completed */
    completedAt?: string;
    /** Asset validation result — written by the agent immediately after generation */
    validation?: StageValidation;
  };
  design?: {
    /** Product Cover — portrait marketing image (first accepted concept) */
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
    /** Multiple cover style concepts (Minimal, Bold, Dark, Modern, Illustrated, Premium) */
    concepts?: Array<{
      style:      string;
      label:      string;
      /** Legacy DALL-E image URL (kept for backwards compat) */
      url?:       string;
      /** designsTable record ID — enables "Open in Design Studio" and full editability */
      designId?:  string;
    }>;
    /** The URL of the cover concept the user selected (defaults to concepts[0].url) */
    selectedConceptUrl?: string;
    /** Design Studio bundle ID for the auto-generated Instagram carousel */
    carouselBundleId?: string;
    /** designsTable ID for the dedicated 800×800 store thumbnail design (editable in Design Studio) */
    thumbnailDesignId?: string;
    /** Asset validation result — written by the agent immediately after generation */
    validation?: StageValidation;
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
    /** Asset validation result — written by the agent immediately after generation */
    validation?: StageValidation;
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
    /** Asset validation result — written by the agent immediately after generation */
    validation?: StageValidation;
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
   * Marketing Department — 7 AI managers owning every marketing channel.
   * Each manager works independently, builds on existing content, and reports
   * to Mission Control. All outputs feed into Business Memory.
   */
  marketingDept?: MarketingDepartment;
  /**
   * Analytics Intelligence — AI analyst that learns from every published post.
   * Collects platform metrics, generates qualitative insights, and produces
   * daily intelligence reports. Every insight feeds into Business Memory.
   */
  analyticsDept?: AnalyticsDepartment;
  /**
   * Business Brain — post-pipeline founder review.
   * Auto-generated when workspace first loads after completion.
   * Critiques all pipeline output and surfaces prioritised recommendations.
   */
  brain?: BrainResult;
  /**
   * In-app notifications — publish events, analytics complete, new lessons, viral.
   * Capped at 100 items (oldest pruned). Read via GET /api/projects/[launchId]/notifications.
   */
  notifications?: AppNotification[];
  /**
   * Phase 6.0 — Integration settings (API keys for stores, analytics, email).
   * Set in project settings. Used by analytics pipeline to fetch real data.
   */
  integrations?: IntegrationSettings;
  /**
   * Phase 6.0 — Daily executive briefing (Business OS).
   * Generated each morning: yesterday's activity, revenue, platform deltas, top lesson.
   * Cached per day; re-generated on next-day load.
   */
  dailyBriefing?: DailyBriefing;
  /**
   * Growth Mode v2 — Phase 6 autonomous growth tasks.
   * Generated by daily/weekly AI reviews using Business Memory + Analytics + Learning Loop.
   * Each task is grounded in evidence from actual project data — no invented metrics.
   */
  growthTasks?: GrowthTask[];
  /**
   * Growth review log — history of all review runs (daily, weekly, manual).
   * Newest first. Each entry records what was found and which tasks were created.
   */
  growthReviews?: GrowthReview[];
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
  /**
   * Phase 7.0 — Autonomous Mode settings per project.
   */
  autonomousMode?: AutonomousMode;
  /**
   * Phase 7.0 — Approval inbox: all AI-generated work waiting for human review.
   * Newest first. Capped at 200 items.
   */
  approvalInbox?: ApprovalItem[];
  /**
   * Phase 7.0 — Company activity feed: every action taken by every department.
   * Newest first. Capped at 500 events.
   */
  activityFeed?: ActivityEvent[];
  /**
   * Phase 7.0 — Latest CEO briefing (one per autonomous cycle, overwritten each run).
   */
  ceoBriefing?: CEOBriefing;
};

/* ─── Phase 7.0: Autonomous Company ─────────────────────────────────────────── */

/** Department IDs used in the autonomous cycle. */
export type AutonomousDepartment =
  | "research" | "marketing" | "design" | "analytics" | "learning" | "memory" | "system";

/** Current phase of an autonomous run. */
export type AutonomousPhase =
  | "idle" | "research" | "marketing" | "design" | "analytics" | "learning" | "memory" | "briefing" | "complete" | "error";

/** Per-project autonomous mode settings. */
export type AutonomousMode = {
  enabled:      boolean;
  schedule:     "daily" | "manual";
  lastRunAt?:   string;
  nextRunAt?:   string;
  cycleCount:   number;
  currentPhase: AutonomousPhase;
  runningFor?:  string; // human-readable duration of current run
  lastError?:   string;
};

/** A single action logged by the autonomous system. */
export type ActivityEvent = {
  id:           string;
  department:   AutonomousDepartment;
  action:       string;       // e.g. "Generated 3 TikTok hooks from trending keywords"
  detail?:      string;       // extended description
  status:       "running" | "completed" | "failed" | "skipped";
  timestamp:    string;
  durationMs?:  number;
  metadata?:    Record<string, unknown>;
};

/** Type of content waiting in the approval inbox. */
export type ApprovalItemType =
  | "content"      // social post, email, blog
  | "content_batch" // multiple posts for a channel
  | "campaign"     // full campaign brief
  | "research"     // research insight or opportunity
  | "growth_task"; // AI-generated growth recommendation

/** A single item waiting for the human's approval. */
export type ApprovalItem = {
  id:            string;
  type:          ApprovalItemType;
  title:         string;
  preview:       string;       // ≤ 200 chars — what to show in the inbox card
  department:    AutonomousDepartment;
  managerId?:    MarketingManagerId;
  status:        "pending" | "approved" | "rejected";
  generatedAt:   string;
  reviewedAt?:   string;
  /** Full generated content — only read when the item is approved/expanded */
  payload:       Record<string, unknown>;
  /** How many pending items are in the same batch (for bulk approve UX) */
  batchSize?:    number;
};

/** Daily executive briefing from the autonomous system. */
export type CEOBriefing = {
  date:             string;
  cycleNumber:      number;
  headline:         string;      // "While you were away, your AI company did 7 things"
  summary:          string;      // 2-3 sentence narrative
  departments:      Array<{
    name:           string;
    department:     AutonomousDepartment;
    status:         "completed" | "failed" | "skipped";
    output:         string;      // 1-line description of what was produced
    itemCount:      number;
  }>;
  itemsGenerated:   number;
  itemsApproved:    number;
  pendingApprovals: number;
  highlights:       string[];    // top wins this cycle
  nextActions:      string[];    // what the CEO should do next
  generatedAt:      string;
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

/* ─── Phase 6.0: Real Execution Layer ───────────────────────────────────────── */

/**
 * Per-project integration settings.
 * Stored in stageResults.integrations (JSONB, no extra table needed).
 * API keys stored here are used for real analytics / revenue fetching.
 */
export type IntegrationSettings = {
  /* Store / Revenue */
  stripe?: {
    /** Optional: restrict revenue to charges from specific products */
    productIds?: string[];
    /** Filter by metadata key=value pairs e.g. { launch_id: "abc" } */
    metadataFilter?: Record<string, string>;
  };
  lemonSqueezy?: {
    apiKey?: string;
    storeId?: string;
  };
  gumroad?: {
    accessToken?: string;
    productId?: string;
  };
  /* Website analytics */
  postHog?: {
    apiKey?: string;
    projectId?: string;
    host?: string; // default https://app.posthog.com
  };
  plausible?: {
    apiKey?: string;
    siteId?: string;
    host?: string; // default https://plausible.io
  };
  googleAnalytics?: {
    propertyId?: string;
    /** Base64-encoded service account JSON */
    serviceAccountJson?: string;
  };
  /* Email analytics */
  resend?: {
    apiKey?: string;
    audienceId?: string;
  };
  brevo?: {
    apiKey?: string;
    listId?: string;
  };
  mailchimp?: {
    apiKey?: string;
    listId?: string;
    server?: string; // e.g. "us1"
  };
};

/** Snapshot of revenue from all connected stores for a given period. */
export type RevenueSnapshot = {
  totalSales:     number;
  totalRevenue:   number;
  currency:       string;
  refunds:        number;
  refundRevenue:  number;
  conversionRate?: number;
  sources:        Array<{ name: string; sales: number; revenue: number }>;
  period:         { from: string; to: string };
};

/** Platform performance delta — used in daily briefing. */
export type PlatformDelta = {
  platform:     MarketingManagerId;
  metric:       "views" | "followers" | "engagement" | "ctr";
  current:      number;
  previous:     number;
  changePercent: number;
  direction:    "up" | "down" | "flat";
};

/** Daily executive briefing — the Business OS morning report. */
export type DailyBriefing = {
  date:               string; // YYYY-MM-DD
  greeting:           string;
  publishedYesterday: number;
  revenue:            { sales: number; amount: number; currency: string };
  platformDeltas:     PlatformDelta[];
  bestContent: {
    content:     string;
    platform:    MarketingManagerId;
    metric:      string;
    value:       number;
    publishedAt: string;
  } | null;
  topLesson:        string | null;
  criticalTasks:    number;
  highTasks:        number;
  growthScore:      "declining" | "flat" | "improving" | "strong";
  growthScoreReason: string;
  generatedAt:       string;
};

/* ─── Phase 6: Growth Mode — autonomous growth engine ───────────────────────── */

export type GrowthTaskType =
  | "content_idea"    // Generate this specific new content
  | "ab_test"         // A/B test hook, title, CTA, or thumbnail
  | "improve_copy"    // Rewrite or strengthen existing copy
  | "fix_declining"   // Fix content that is losing traction
  | "new_opportunity" // Target a keyword, trend, or platform gap
  | "campaign"        // Launch a new campaign or sequence
  | "product_improve" // Improve product listing, landing page, or description
  | "repost"          // Reshare or repurpose top-performing content
  | "engagement";     // Respond to audience, build community

export type GrowthTaskPriority = "critical" | "high" | "medium" | "low";
export type GrowthTaskStatus   = "pending" | "in_progress" | "done" | "dismissed";
export type GrowthReviewType   = "daily" | "weekly" | "manual";

export type GrowthTask = {
  id:              string;
  type:            GrowthTaskType;
  priority:        GrowthTaskPriority;
  status:          GrowthTaskStatus;
  title:           string;
  description:     string;
  /** What evidence in the analytics or memory drove this recommendation */
  reasoning:       string;
  /** Qualitative impact — no invented percentages */
  estimatedImpact: string;
  /** Platform this task is for, if applicable */
  managerId?:      MarketingManagerId;
  /** Existing asset to build on (URL, title, or description) */
  referenceAsset?: string;
  /** One concrete next step the user can take immediately */
  suggestedAction?: string;
  createdAt:       string;
  completedAt?:    string;
  reviewId:        string;
};

export type GrowthReview = {
  id:              string;
  type:            GrowthReviewType;
  runAt:           string;
  tasksGenerated:  number;
  summary:         string;
  topOpportunity?: string;
  topProblem?:     string;
  newTaskIds:      string[];
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
  source:          string; // "auto" | "brain" | "mission_control" | "user" | "worker:marketing" | "learning" etc.
  confidence:      "high" | "medium" | "low";
  /** User explicitly confirmed or wrote this — never auto-overwritten */
  confirmedByUser: boolean;
  addedAt:         string;
  updatedAt:       string;
  /** How many times this fact has been independently reinforced — used to upgrade confidence */
  evidenceCount?:  number;
  /** ISO of the last time this fact was seen/reinforced */
  lastReinforced?: string;
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

/* ─── Marketing Department types ────────────────────────────────────────────── */

export type MarketingManagerId =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "x"
  | "linkedin"
  | "email"
  | "seo";

export type ManagerStatus =
  | "idle"           // Planning — ready to create
  | "running"        // Creating — generating content
  | "waiting_approval" // Waiting for user to approve a queue item
  | "publishing"     // Publishing — uploading to platform
  | "monitoring"     // Monitoring results
  | "paused"         // Paused by user
  | "error";         // Last run errored

/* ── Publishing system types ── */

export type ApprovalMode = "manual" | "balanced" | "autopilot";

export type PublishScheduleMode = "immediate" | "scheduled" | "recurring" | "mission_control";

export type PublishingSchedule = {
  mode:            PublishScheduleMode;
  /** ISO datetime — used when mode = "scheduled" */
  scheduledAt?:    string;
  /** cron expression — used when mode = "recurring" */
  recurringCron?:  string;
  /** Human label e.g. "Every weekday at 9am" */
  recurringLabel?: string;
  timezone?:       string;
};

export type ManagerPublishingConfig = {
  approvalMode: ApprovalMode;
  schedule:     PublishingSchedule;
};

export type QueueItemStatus =
  | "queued"         // Waiting for approval or schedule
  | "rendering"      // Preparing content for upload
  | "uploading"      // Calling platform API
  | "published"      // Successfully live
  | "failed"         // Upload errored
  | "scheduled";     // Approved, waiting for scheduled time

export type PublishQueueItem = {
  id:            string;
  managerId:     MarketingManagerId;
  outputId:      string;
  outputType:    string;
  /** Formatted content ready to publish */
  content:       string;
  status:        QueueItemStatus;
  approvalMode:  ApprovalMode;
  approvedAt?:   string;
  approvedBy?:   "user" | "ai";
  scheduledAt?:  string;
  publishedAt?:  string;
  publishedUrl?: string;
  errorMessage?: string;
  retryCount:    number;
  createdAt:     string;
};

export type PublishedItem = {
  id:              string;
  managerId:       MarketingManagerId;
  outputId:        string;
  content:         string;
  publishedAt:     string;
  publishedUrl?:   string;
  /** Platform-native post ID — used to fetch real analytics via platform APIs */
  platformPostId?: string;
  /** Account ID on the platform (channel_id, user_id, etc.) */
  platformAccountId?: string;
  analytics?: {
    views?:      number;
    likes?:      number;
    shares?:     number;
    clicks?:     number;
    engagement?: number;
    lastChecked?: string;
  };
};

export type ManagerOutput = {
  id:         string;
  /** e.g. "hook" | "video_script" | "caption" | "carousel" | "tweet_thread" | "email" | etc. */
  type:       string;
  /** Plain string for simple outputs; JSON.stringify for complex (scripts, threads, etc.) */
  content:    string;
  /** What angle or approach this batch took */
  angle?:     string;
  createdAt:  string;
};

export type ManagerTask = {
  id:            string;
  label:         string;
  instruction?:  string;
  status:        "pending" | "running" | "done" | "failed";
  createdAt:     string;
  completedAt?:  string;
  result?:       string;
  outputCount?:  number;
};

export type ManagerSuggestion = {
  id:          string;
  label:       string;
  reason:      string;
  priority:    "high" | "medium" | "low";
  suggestedAt: string;
};

export type MarketingManager = {
  id:               MarketingManagerId;
  status:           ManagerStatus;
  /** Live step description while running */
  currentTask?:     string;
  /** AI task queue (from Mission Control / manual) */
  queue:            ManagerTask[];
  history:          ManagerTask[];
  /** All content outputs produced by this manager */
  outputs:          ManagerOutput[];
  suggestions:      ManagerSuggestion[];
  lastRunAt?:       string;
  runCount:         number;
  /** Publishing configuration (approval mode + schedule) */
  publishingConfig?: ManagerPublishingConfig;
  /** Items queued/in-progress/published */
  publishQueue?:    PublishQueueItem[];
  /** Successfully published items with analytics */
  publishedItems?:  PublishedItem[];
};

export type PlatformConnectionStatus = {
  connected:    boolean;
  accountName?: string;
  connectedAt?: string;
};

export type MarketingDepartment = {
  managers:     Partial<Record<MarketingManagerId, MarketingManager>>;
  /** Denormalised connection status cache (source of truth is connected_accounts table) */
  connections?: Partial<Record<MarketingManagerId, PlatformConnectionStatus>>;
  lastUpdated?: string;
};

/* ─── Analytics Intelligence types ──────────────────────────────────────────── */

export type AnalyticsMetrics = {
  views?:           number;
  reach?:           number;
  impressions?:     number;
  /** Average watch time in seconds (video platforms) */
  watchTime?:       number;
  /** Retention percentage 0–100 */
  retention?:       number;
  likes?:           number;
  comments?:        number;
  shares?:          number;
  saves?:           number;
  /** Click-through rate percentage */
  ctr?:             number;
  conversions?:     number;
  sales?:           number;
  revenue?:         number;
  followersGained?: number;
  profileVisits?:   number;
  linkClicks?:      number;
  /** ISO timestamp of last metrics fetch */
  lastFetched?:     string;
};

export type ContentMetadata = {
  hook?:        string;
  cta?:         string;
  hashtags?:    string[];
  thumbnail?:   string;
  topic?:       string;
  /** Duration in seconds for video content */
  duration?:    number;
  caption?:     string;
};

export type AnalyticsInsightType =
  | "win"            // Something that performed exceptionally well
  | "problem"        // Something that underperformed or hurt metrics
  | "trend"          // Pattern spotted across multiple posts
  | "anomaly"        // Surprising deviation from normal
  | "recommendation";// Actionable next step

export type AnalyticsInsight = {
  id:          string;
  type:        AnalyticsInsightType;
  /** Human-readable analysis — qualitative, grounded in data */
  text:        string;
  /** The metric(s) supporting this insight */
  evidence?:   string;
  metric?:     string;
  confidence:  "high" | "medium" | "low";
  createdAt:   string;
};

export type RecommendationStatus = "pending" | "accepted" | "ignored" | "auto_apply";

export type AnalyticsRecommendation = {
  id:          string;
  text:        string;
  /** Why the AI is making this recommendation, grounded in data */
  reasoning:   string;
  impact:      "high" | "medium" | "low";
  category:    "content" | "timing" | "hooks" | "cta" | "format" | "hashtags" | "topic" | "platform";
  status:      RecommendationStatus;
  /** Which manager this applies to, if specific */
  managerId?:  MarketingManagerId;
  createdAt:   string;
  appliedAt?:  string;
};

export type PostAnalytics = {
  id:           string;
  managerId:    MarketingManagerId;
  /** References PublishedItem.id in marketingDept */
  publishedItemId: string;
  platform:     string;
  publishedAt:  string;
  /** The actual content that was published */
  content:      string;
  metadata:     ContentMetadata;
  metrics:      AnalyticsMetrics;
  /** AI-generated qualitative insights for this post */
  insights:     AnalyticsInsight[];
  analysedAt?:  string;
};

export type IntelligenceReportSummary = {
  postsPublished:  number;
  totalReach:      number;
  totalViews:      number;
  followersGained: number;
  sales:           number;
  revenue:         number;
};

export type IntelligenceReportHighlight = {
  postId:    string;
  platform:  string;
  reason:    string;
  metric:    string;
  value:     number;
};

export type DailyIntelligenceReport = {
  id:           string;
  /** YYYY-MM-DD */
  date:         string;
  summary:      IntelligenceReportSummary;
  biggestWin?:  IntelligenceReportHighlight;
  biggestProblem?: { postId?: string; platform?: string; description: string };
  insights:     AnalyticsInsight[];
  recommendations: AnalyticsRecommendation[];
  /** Prose narrative — the "briefing" the founder reads */
  narrative?:   string;
  generatedAt:  string;
};

export type LessonCategory =
  | "hooks"      // What hooks work / don't work
  | "cta"        // Which CTAs convert
  | "timing"     // When to post
  | "format"     // Video vs carousel vs text etc.
  | "style"      // Visual / tone style findings
  | "topic"      // Which topics resonate
  | "platform"   // Platform-specific findings
  | "avoid";     // Patterns that consistently underperform

export type LearningLesson = {
  id:            string;
  category:      LessonCategory;
  /** Specific, actionable finding — e.g. "Hooks under 8 words outperform longer ones on TikTok" */
  lesson:        string;
  /** The data that supports this — e.g. "3 posts with short hooks averaged 67% retention vs 31% for long hooks" */
  evidence:      string;
  /** How many independent data points support this lesson */
  evidenceCount: number;
  confidence:    "high" | "medium" | "low";
  /** Which platforms this lesson applies to */
  platforms:     MarketingManagerId[];
  firstSeenAt:   string;
  lastSeenAt:    string;
  /** Is this pattern getting stronger or weaker over time? */
  trend?:        "improving" | "declining" | "stable";
};

export type PerformanceTrend = {
  metric:        string;   // "retention" | "ctr" | "reach" | "views" | "followers_gained"
  platform:      MarketingManagerId;
  direction:     "up" | "down" | "stable";
  /** Percentage change — positive = improvement */
  changePercent: number;
  dataPoints:    Array<{ date: string; value: number }>;
  /** Human-readable summary — "Avg TikTok retention improved 12% over last 7 days" */
  summary:       string;
};

export type AnalyticsDepartment = {
  /** All tracked posts with their metrics and AI insights */
  posts:            PostAnalytics[];
  /** Global recommendations across all platforms */
  recommendations:  AnalyticsRecommendation[];
  /** Daily intelligence reports, newest first, capped at 30 */
  reports:          DailyIntelligenceReport[];
  /** Structured reusable lessons extracted from performance comparisons */
  lessons?:         LearningLesson[];
  /** Metric trends over time per platform */
  trends?:          PerformanceTrend[];
  /** How many learning cycles have completed */
  learningCycles?:  number;
  /** "What the company learned today" — 2-sentence AI summary */
  todaysSummary?:   string;
  lastAnalysedAt?:  string;
  lastReportAt?:    string;
  lastLearnedAt?:   string;
};

/* ─── Phase 5.3: Notifications + Pipeline types ─────────────────────────────── */

export type NotificationEvent =
  | "publish_success"     // Content published successfully
  | "publish_failed"      // Publishing failed
  | "analytics_complete"  // AI analysis finished for a post
  | "new_lesson"          // Learning cycle extracted new lessons
  | "viral_post"          // Post crossed a viral-views threshold
  | "learning_complete";  // Full learning cycle finished

export type AppNotification = {
  id:         string;
  event:      NotificationEvent;
  title:      string;
  message:    string;
  read:       boolean;
  /** Deep link to the relevant section */
  href?:      string;
  /** Which manager/platform triggered this, if applicable */
  managerId?: MarketingManagerId;
  createdAt:  string;
};

export type ScheduleRecommendation = {
  /** e.g. "Tuesday" */
  bestDay:       string;
  /** e.g. "18:00" */
  bestTime:      string;
  /** Primary platform recommendation */
  bestPlatform:  MarketingManagerId;
  /** Ordered platform list (best first) */
  platformOrder: MarketingManagerId[];
  /** Short qualitative reason grounded in Business Memory / analytics */
  reasoning:     string;
  /** ISO datetime of the recommended next slot */
  scheduledAt:   string;
};

export type ContentTimelineEvent = {
  id:        string;
  stage:     "created" | "queued" | "approved" | "scheduled" | "published" | "analysed" | "lessons" | "memory";
  label:     string;
  detail?:   string;
  timestamp: string;
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
