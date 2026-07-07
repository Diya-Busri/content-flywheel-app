/**
 * lib/memory-context.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Business Memory utilities — pure functions, no DB access.
 *
 * Three responsibilities:
 *   1. extractMemoryFacts  — deterministically derive facts from stageResults
 *   2. mergeMemoryFacts    — merge new extraction into existing memory (respects user edits)
 *   3. buildMemoryContext  — format relevant facts as a concise prompt block
 */

import type {
  LaunchStageResults,
  BusinessMemory,
  MemoryFact,
  MemoryCategory,
  WorkerId,
} from "@/db/schema/launch-schema";

/* ─── Category relevance per worker ─────────────────────────────────────────── */

export const WORKER_MEMORY_CATEGORIES: Record<WorkerId, MemoryCategory[]> = {
  research:  ["brand", "audience", "knowledge", "marketing"],
  marketing: ["brand", "audience", "marketing", "knowledge"],
  store:     ["brand", "products", "marketing", "analytics"],
  product:   ["brand", "audience", "products", "lessons"],
  design:    ["brand", "audience", "products"],
  growth:    ["brand", "products", "analytics", "marketing", "lessons"],
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeFact(
  category:   MemoryCategory,
  key:        string,
  label:      string,
  value:      string,
  confidence: "high" | "medium" | "low",
  source:     string,
): MemoryFact {
  const now = new Date().toISOString();
  return {
    id:              uid(),
    category,
    key,
    label,
    value,
    source,
    confidence,
    confirmedByUser: false,
    addedAt:         now,
    updatedAt:       now,
  };
}

/* ─── Deterministic extraction ───────────────────────────────────────────────── */

/**
 * Derives memory facts from stageResults without calling any AI.
 * Called after every worker run and on-demand from the memory/extract endpoint.
 */
export function extractMemoryFacts(
  results: LaunchStageResults,
  goal:    string,
): MemoryFact[] {
  const facts: MemoryFact[] = [];
  const r = results;

  /* ── Brand ── */
  if (r.product?.productName) {
    facts.push(makeFact("brand", "product_name", "Product Name", r.product.productName, "high", "auto"));
  }
  if (goal) {
    facts.push(makeFact("brand", "business_goal", "Business Goal", goal, "high", "auto"));
  }
  if (r.marketing?.salesCopy?.headline) {
    facts.push(makeFact("brand", "main_headline", "Main Headline", r.marketing.salesCopy.headline, "high", "auto"));
  }
  if (r.marketing?.salesCopy?.subheadline) {
    facts.push(makeFact("brand", "sub_headline", "Sub-headline", r.marketing.salesCopy.subheadline, "medium", "auto"));
  }
  if (r.marketing?.seoTitle) {
    facts.push(makeFact("brand", "seo_title", "SEO Title", r.marketing.seoTitle, "high", "auto"));
  }
  if (r.marketing?.seoMetaDesc) {
    facts.push(makeFact("brand", "seo_meta_desc", "SEO Meta Description", r.marketing.seoMetaDesc, "high", "auto"));
  }
  if (r.marketing?.tags?.length) {
    facts.push(makeFact("brand", "product_tags", "Product Tags", r.marketing.tags.join(", "), "medium", "auto"));
  }

  /* ── Audience ── */
  const fullReport = r.research?.fullReport as Record<string, unknown> | undefined;
  if (fullReport?.targetAudience) {
    facts.push(makeFact("audience", "target_audience", "Target Audience", String(fullReport.targetAudience), "medium", "auto"));
  }
  if (fullReport?.niche) {
    facts.push(makeFact("audience", "niche", "Market Niche", String(fullReport.niche), "medium", "auto"));
  }
  if (r.marketing?.faq?.length) {
    const faqs = r.marketing.faq.slice(0, 4).map(f => `Q: ${f.q}`).join(" | ");
    facts.push(makeFact("audience", "key_faqs", "Key FAQs / Objections", faqs, "medium", "auto"));
  }
  if (r.marketing?.marketplaceDesc) {
    facts.push(makeFact("audience", "marketplace_description", "Marketplace Description", r.marketing.marketplaceDesc, "medium", "auto"));
  }
  if (r.marketing?.salesCopy?.body) {
    // Extract positioning from sales copy body (first 200 chars)
    const snippet = r.marketing.salesCopy.body.slice(0, 200).replace(/\n+/g, " ").trim();
    facts.push(makeFact("audience", "sales_positioning", "Sales Positioning", snippet, "low", "auto"));
  }

  /* ── Products ── */
  if (r.product?.productId) {
    facts.push(makeFact("products", "product_id", "Product ID", r.product.productId, "high", "auto"));
  }
  if (r.store?.storeUrl) {
    facts.push(makeFact("products", "store_url", "Store URL", r.store.storeUrl, "high", "auto"));
  }
  if (r.store?.readinessScore !== undefined) {
    facts.push(makeFact("products", "store_readiness", "Store Readiness Score", `${r.store.readinessScore}%`, "medium", "auto"));
  }
  if (r.store?.publishedAt) {
    facts.push(makeFact("products", "published_at", "Published Date", r.store.publishedAt.slice(0, 10), "high", "auto"));
  }

  /* ── Marketing ── */
  if (r.research?.keywords?.length) {
    const topKws = r.research.keywords.slice(0, 8).map(k => k.term).join(", ");
    facts.push(makeFact("marketing", "top_keywords", "Top Keywords", topKws, "high", "auto"));

    const highOpp = r.research.keywords.filter(k => k.opportunity === "high").map(k => k.term);
    if (highOpp.length) {
      facts.push(makeFact("marketing", "high_opportunity_keywords", "High-Opportunity Keywords", highOpp.join(", "), "high", "auto"));
    }
  }

  const tiktokCount  = r.marketing?.tiktokHooks?.length        ?? 0;
  const emailCount   = r.marketing?.emails?.length              ?? 0;
  const carouselCount = r.marketing?.carousels?.length          ?? 0;
  const xCount       = r.marketing?.xPosts?.length              ?? 0;
  const igCount      = r.marketing?.instagramCaptions?.length   ?? 0;
  if (tiktokCount + emailCount + carouselCount + xCount + igCount > 0) {
    facts.push(makeFact(
      "marketing", "content_library_size", "Content Library",
      `TikTok hooks: ${tiktokCount}, Emails: ${emailCount}, Carousels: ${carouselCount}, X posts: ${xCount}, IG captions: ${igCount}`,
      "high", "auto",
    ));
  }
  if (r.marketing?.tiktokHooks?.[0]) {
    facts.push(makeFact("marketing", "best_tiktok_hook", "Best TikTok Hook (example)", r.marketing.tiktokHooks[0], "medium", "auto"));
  }
  if (r.marketing?.launchAnnouncement) {
    facts.push(makeFact("marketing", "launch_announcement", "Launch Announcement", r.marketing.launchAnnouncement, "medium", "auto"));
  }

  /* ── Knowledge ── */
  if (r.research?.competitorInsights?.length) {
    const comps = r.research.competitorInsights
      .slice(0, 5)
      .map(c => `${c.name} — gap: ${c.gap}`)
      .join("; ");
    facts.push(makeFact("knowledge", "competitors", "Competitors & Gaps", comps, "high", "auto"));
  }
  if (r.research?.insights?.length) {
    facts.push(makeFact("knowledge", "market_insights", "Market Insights", r.research.insights.slice(0, 3).join(" | "), "medium", "auto"));
  }
  if (r.research?.reportSummary) {
    facts.push(makeFact("knowledge", "market_summary", "Market Summary", r.research.reportSummary, "medium", "auto"));
  }

  /* ── Analytics ── */
  if (r.brain?.businessScore !== undefined) {
    facts.push(makeFact("analytics", "business_score", "Business Score", `${r.brain.businessScore}/100`, "high", "brain"));
  }
  if (r.brain?.launchScore !== undefined) {
    facts.push(makeFact("analytics", "launch_score", "Launch Score", `${r.brain.launchScore}/100`, "high", "brain"));
  }
  if (r.growth?.report?.healthScore !== undefined) {
    facts.push(makeFact("analytics", "growth_health_score", "Growth Health Score", `${r.growth.report.healthScore}/100`, "high", "auto"));
  }
  if (r.growth?.goal) {
    const g = r.growth.goal;
    facts.push(makeFact(
      "analytics", "current_goal", "Current Business Goal",
      `${g.label} — ${g.current}/${g.target} ${g.unit}`,
      "high", "auto",
    ));
  }
  if (r.growth?.report?.summary) {
    facts.push(makeFact("analytics", "growth_summary", "Growth Summary", r.growth.report.summary, "medium", "auto"));
  }

  /* ── Launches ── */
  if (r.missionControl?.currentPlan) {
    const plan = r.missionControl.currentPlan;
    facts.push(makeFact("launches", "mc_focus", "Mission Control Focus", `${plan.focus}: ${plan.mission}`, "high", "mission_control"));
    facts.push(makeFact("launches", "mc_reason", "Focus Reason", plan.missionReason, "medium", "mission_control"));
  }
  if (r.marketing?.completedAt) {
    facts.push(makeFact("launches", "campaign_launched_at", "Marketing Campaign Created", r.marketing.completedAt.slice(0, 10), "high", "auto"));
  }

  /* ── Lessons (from Brain) ── */
  if (r.brain?.reviewSummary) {
    facts.push(makeFact("lessons", "brain_review_summary", "Business Brain Summary", r.brain.reviewSummary, "medium", "brain"));
  }
  if (r.brain?.recommendations?.length) {
    const highPrio = r.brain.recommendations.filter(rec => rec.priority === "high").slice(0, 3);
    if (highPrio.length) {
      const lesson = highPrio.map(rec => `[${rec.category}] ${rec.title}`).join("; ");
      facts.push(makeFact("lessons", "brain_priorities", "Top Brain Priorities", lesson, "high", "brain"));
    }
  }

  /* ── Worker history summaries ── */
  if (r.workforce?.workers) {
    const totalRuns = Object.values(r.workforce.workers).reduce(
      (sum, w) => sum + (w?.history?.length ?? 0), 0,
    );
    if (totalRuns > 0) {
      facts.push(makeFact("analytics", "total_worker_runs", "Total Worker Runs", `${totalRuns}`, "medium", "auto"));
    }
  }

  return facts;
}

/* ─── Merge ──────────────────────────────────────────────────────────────────── */

/**
 * Merges freshly-extracted facts into existing memory.
 *
 * Rules:
 *  — User-confirmed facts (confirmedByUser = true) are NEVER overwritten
 *  — For same (category, key): newer extracted fact replaces older auto fact
 *  — Facts with source "user" are treated as confirmed
 *  — New keys are always added
 */
export function mergeMemoryFacts(
  existing:  MemoryFact[],
  extracted: MemoryFact[],
): MemoryFact[] {
  const byKey = new Map<string, MemoryFact>();

  // Load existing facts keyed by category+key
  for (const fact of existing) {
    byKey.set(`${fact.category}::${fact.key}`, fact);
  }

  // Merge extracted — skip if user-confirmed exists
  for (const fact of extracted) {
    const mapKey = `${fact.category}::${fact.key}`;
    const existing = byKey.get(mapKey);
    if (existing && (existing.confirmedByUser || existing.source === "user")) {
      continue; // never overwrite user-confirmed facts
    }
    // Update: keep original addedAt, update updatedAt
    byKey.set(mapKey, {
      ...fact,
      id:      existing?.id ?? fact.id,
      addedAt: existing?.addedAt ?? fact.addedAt,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

/* ─── Context builders ───────────────────────────────────────────────────────── */

/**
 * Builds a concise memory block for injection into worker prompts.
 * Only includes facts from the specified categories, capped at ~15 facts.
 */
export function buildMemoryContext(
  memory:     BusinessMemory | undefined | null,
  categories: MemoryCategory[],
): string {
  if (!memory?.facts?.length) return "";

  const relevant = memory.facts
    .filter(f => categories.includes(f.category) && f.confidence !== "low")
    .sort((a, b) => {
      // High confidence first, then by category
      const cScore = (c: MemoryFact) => c.confidence === "high" ? 0 : 1;
      return cScore(a) - cScore(b) || a.category.localeCompare(b.category);
    })
    .slice(0, 15);

  if (!relevant.length) return "";

  const lines = relevant.map(f => `• ${f.label}: ${f.value}`);
  return `\nBUSINESS MEMORY (use this context to generate better, more consistent output — don't repeat what's already been done):\n${lines.join("\n")}\n`;
}

/**
 * Builds a full memory context block for Mission Control (CEO AI needs all context).
 */
export function buildFullMemoryContext(memory: BusinessMemory | undefined | null): string {
  if (!memory?.facts?.length) return "";

  const ALL_CATEGORIES: MemoryCategory[] = [
    "brand", "audience", "products", "marketing",
    "launches", "analytics", "ideas", "lessons", "knowledge",
  ];
  return buildMemoryContext(memory, ALL_CATEGORIES);
}
