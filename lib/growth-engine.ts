/**
 * Growth Engine — Phase 6
 * ──────────────────────────────────────────────────────────────────────────────
 * Autonomous growth review engine. Loads ALL project context from Business
 * Memory, Analytics, Learning Loop, and published content — then asks Claude
 * to generate specific, evidence-grounded growth tasks.
 *
 * Rules baked into every prompt:
 *  1. Never recommend regenerating existing content — improve or build on it
 *  2. Every task must cite a specific data point from analytics or memory
 *  3. No invented confidence scores or percentage uplifts without evidence
 *  4. Critical = immediate revenue/retention risk; High = strong opportunity
 *  5. Deduplication: never generate tasks too similar to pending ones
 */

import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  GrowthTask,
  GrowthTaskType,
  GrowthTaskPriority,
  GrowthReview,
  GrowthReviewType,
  MarketingManagerId,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

const ai = new Anthropic();

/* ─── Limits by review type ──────────────────────────────────────────────────── */

const MAX_TASKS: Record<GrowthReviewType, number> = {
  daily:  5,
  weekly: 10,
  manual: 8,
};

/* ─── Context builders ───────────────────────────────────────────────────────── */

function buildMemoryContext(results: LaunchStageResults): string {
  const mem = results.memory;
  if (!mem) return "No Business Memory yet.";

  const lines: string[] = [];

  if (mem.brandVoice) {
    lines.push(`Brand voice: ${mem.brandVoice.tone}. Values: ${mem.brandVoice.coreValues?.join(", ") ?? "none"}.`);
  }
  if (mem.audience) {
    lines.push(`Target audience: ${mem.audience.primarySegment ?? "unknown"}. Pain points: ${mem.audience.painPoints?.join("; ") ?? "none"}.`);
  }
  if (mem.positioning?.uniqueAngle) {
    lines.push(`Positioning: ${mem.positioning.uniqueAngle}.`);
  }
  if (mem.facts?.length) {
    const highConf = mem.facts.filter(f => f.confidence === "high").slice(0, 5);
    if (highConf.length) {
      lines.push(`High-confidence learnings: ${highConf.map(f => `"${f.fact}"`).join("; ")}.`);
    }
  }
  if (mem.contentStrategy?.bestPerformingFormats?.length) {
    lines.push(`Best-performing formats: ${mem.contentStrategy.bestPerformingFormats.join(", ")}.`);
  }
  if (mem.contentStrategy?.worstPerformingFormats?.length) {
    lines.push(`Worst-performing formats: ${mem.contentStrategy.worstPerformingFormats.join(", ")}.`);
  }

  return lines.length ? lines.join("\n") : "Memory exists but no structured facts yet.";
}

function buildAnalyticsContext(results: LaunchStageResults): string {
  const dept = results.analyticsDept;
  if (!dept?.posts?.length) return "No published analytics data yet.";

  const lines: string[] = [`${dept.posts.length} published posts analysed.`];

  // Performance summary
  const analysed = dept.posts.filter(p => p.analysedAt);
  if (analysed.length) {
    const totalViews = analysed.reduce((s, p) => s + (p.metrics.views ?? 0), 0);
    const avgViews   = Math.round(totalViews / analysed.length);
    lines.push(`Average views per post: ${avgViews.toLocaleString()}.`);

    // Best and worst performers
    const sorted = [...analysed].sort((a, b) => (b.metrics.views ?? 0) - (a.metrics.views ?? 0));
    const best   = sorted[0];
    const worst  = sorted[sorted.length - 1];
    if (best) {
      lines.push(`Best post (${best.managerId}): ${(best.metrics.views ?? 0).toLocaleString()} views — "${best.content.slice(0, 80)}…"`);
    }
    if (worst && worst.id !== best?.id) {
      lines.push(`Weakest post (${worst.managerId}): ${(worst.metrics.views ?? 0).toLocaleString()} views — "${worst.content.slice(0, 80)}…"`);
    }

    // Declining posts (no engagement score or very low)
    const declining = analysed.filter(p => (p.metrics.views ?? 0) < avgViews * 0.3);
    if (declining.length) {
      lines.push(`Declining posts (below 30% of average): ${declining.length} posts on ${[...new Set(declining.map(p => p.managerId))].join(", ")}.`);
    }
  }

  // Latest report insights
  const report = dept.latestReport;
  if (report) {
    if (report.topInsights?.length) {
      lines.push(`Top AI insights: ${report.topInsights.slice(0, 3).map(i => `"${i.text.slice(0, 100)}"`).join("; ")}.`);
    }
    if (report.recommendations?.length) {
      const actionable = report.recommendations.filter(r => !r.accepted).slice(0, 3);
      if (actionable.length) {
        lines.push(`Unacted recommendations: ${actionable.map(r => `"${r.text.slice(0, 80)}"`).join("; ")}.`);
      }
    }
    if (report.biggestWin) {
      lines.push(`Biggest win: ${report.biggestWin}.`);
    }
    if (report.biggestProblem) {
      lines.push(`Biggest problem: ${report.biggestProblem}.`);
    }
  }

  return lines.join("\n");
}

function buildLearningContext(results: LaunchStageResults): string {
  const dept = results.analyticsDept;
  if (!dept?.lessons?.length && !dept?.trends?.length) return "No learning cycle data yet.";

  const lines: string[] = [];

  if (dept.lessons?.length) {
    const recent = dept.lessons
      .filter(l => l.confidence === "high" || l.confidence === "medium")
      .slice(0, 5);
    if (recent.length) {
      lines.push(`Key lessons (${dept.lessons.length} total, showing top ${recent.length}):`);
      recent.forEach(l => {
        lines.push(`  - [${l.platform}/${l.category}] "${l.lesson}" (${l.confidence} confidence, ${l.evidenceCount ?? 1} evidence${(l.evidenceCount ?? 1) !== 1 ? "s" : ""})`);
      });
    }
  }

  if (dept.trends?.length) {
    lines.push(`Performance trends:`);
    dept.trends.slice(0, 4).forEach(t => {
      lines.push(`  - ${t.platform} ${t.metric}: ${t.direction} (${t.changePercent ?? "unknown"}% change). ${t.observation ?? ""}`);
    });
  }

  return lines.join("\n") || "Learning data exists but no structured lessons yet.";
}

function buildContentContext(results: LaunchStageResults): string {
  const dept = results.marketingDept;
  if (!dept) return "No Marketing Department data.";

  const lines: string[] = [];
  const MANAGERS: MarketingManagerId[] = ["tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo"];

  MANAGERS.forEach(id => {
    const mgr = dept[id];
    if (!mgr) return;
    const queued    = (mgr.outputs ?? []).filter(o => o.status === "queued").length;
    const published = (mgr.publishedItems ?? []).length;
    const approved  = (mgr.outputs ?? []).filter(o => o.status === "approved").length;
    if (published || queued || approved) {
      lines.push(`${id}: ${published} published, ${queued} queued, ${approved} approved.`);
    }
  });

  return lines.length ? lines.join("\n") : "No content produced yet.";
}

function buildExistingTasksContext(tasks: GrowthTask[]): string {
  const pending = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
  if (!pending.length) return "No pending growth tasks.";
  return `Existing pending tasks (do not duplicate):\n${pending.map(t => `  - [${t.type}] "${t.title}"`).join("\n")}`;
}

function buildResearchContext(results: LaunchStageResults): string {
  const r = results.research;
  if (!r) return "No research data.";

  const lines: string[] = [];
  if (r.keywords?.length) {
    lines.push(`Keywords from research: ${r.keywords.slice(0, 8).map(k => `"${k.term}" (${k.intent})`).join(", ")}.`);
  }
  if (r.competitorInsights?.length) {
    lines.push(`Competitor gaps: ${r.competitorInsights.slice(0, 3).map(c => `${c.name}: gap="${c.gap}"`).join("; ")}.`);
  }
  if (r.reportSummary) {
    lines.push(`Market summary: ${r.reportSummary.slice(0, 200)}.`);
  }
  return lines.join("\n") || "Research exists but no structured data.";
}

/* ─── Prompt ─────────────────────────────────────────────────────────────────── */

function buildPrompt(
  goal: string,
  reviewType: GrowthReviewType,
  results: LaunchStageResults,
  existingTasks: GrowthTask[],
  maxTasks: number,
): string {
  return `You are the AI Head of Marketing conducting a ${reviewType} growth review for this business.

BUSINESS GOAL:
${goal}

PRODUCT:
${results.product?.productName ?? "Not yet named"}

BUSINESS MEMORY:
${buildMemoryContext(results)}

ANALYTICS & PERFORMANCE:
${buildAnalyticsContext(results)}

LEARNING LOOP INSIGHTS:
${buildLearningContext(results)}

CONTENT PIPELINE STATUS:
${buildContentContext(results)}

RESEARCH & KEYWORDS:
${buildResearchContext(results)}

${buildExistingTasksContext(existingTasks)}

---

Generate up to ${maxTasks} actionable growth tasks. Return ONLY a JSON object in this exact format:

{
  "summary": "2-3 sentence review summary grounded in the data above",
  "topOpportunity": "single biggest opportunity (1 sentence)",
  "topProblem": "single biggest problem to fix (1 sentence)",
  "tasks": [
    {
      "type": "content_idea|ab_test|improve_copy|fix_declining|new_opportunity|campaign|product_improve|repost|engagement",
      "priority": "critical|high|medium|low",
      "title": "Short imperative title (max 8 words)",
      "description": "What to do and why — 2-3 sentences",
      "reasoning": "Specific data point that drives this task (cite views, lessons, keywords, etc.)",
      "estimatedImpact": "Qualitative impact — never invent percentages without evidence",
      "managerId": "tiktok|instagram|youtube|x|linkedin|email|seo or null",
      "referenceAsset": "Title or brief description of existing asset to build on, or null",
      "suggestedAction": "One concrete immediate action the user can take"
    }
  ]
}

CRITICAL RULES:
1. Never recommend regenerating content that already exists — always improve, build on, or repurpose it
2. Every task reasoning must cite a specific data point (views, lesson, keyword, trend direction)
3. Never invent percentage uplifts or confidence scores without evidence from the data provided
4. Critical priority = immediate revenue or retention risk with clear evidence
5. If analytics are sparse, focus on fundamentals (launch basics, content gaps, quick wins)
6. ${reviewType === "weekly" ? "Weekly review: think strategically — campaign opportunities, positioning, long-term bets" : "Daily review: focus on immediate fixes, quick wins, and urgent opportunities"}
7. Return ONLY valid JSON — no markdown, no extra text`;
}

/* ─── Raw AI task type ───────────────────────────────────────────────────────── */

interface RawTask {
  type:             string;
  priority:         string;
  title:            string;
  description:      string;
  reasoning:        string;
  estimatedImpact:  string;
  managerId?:       string | null;
  referenceAsset?:  string | null;
  suggestedAction?: string;
}

/* ─── Main export ────────────────────────────────────────────────────────────── */

export async function runGrowthReview(
  launchId: string,
  userId: string,
  reviewType: GrowthReviewType,
): Promise<{ review: GrowthReview; newTasks: GrowthTask[] }> {
  /* ── Load project ── */
  const [row] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));

  if (!row) throw new Error("Project not found");

  const results: LaunchStageResults = row.stageResults ?? {};
  const existingTasks: GrowthTask[] = results.growthTasks ?? [];
  const existingReviews: GrowthReview[] = results.growthReviews ?? [];

  const maxTasks = MAX_TASKS[reviewType];

  /* ── Call Claude ── */
  let rawOutput = "";
  try {
    const msg = await ai.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 2500,
      messages: [{
        role:    "user",
        content: buildPrompt(row.goal, reviewType, results, existingTasks, maxTasks),
      }],
    });
    rawOutput = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  } catch {
    rawOutput = "";
  }

  /* ── Parse response ── */
  let parsed: { summary?: string; topOpportunity?: string; topProblem?: string; tasks?: RawTask[] } = {};
  try {
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch {
    /* fallback below */
  }

  const reviewId = randomUUID();
  const now      = new Date().toISOString();

  /* ── Build GrowthTask[] ── */
  const rawTasks: RawTask[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];

  // Deduplicate against existing pending tasks by title similarity
  const pendingTitles = existingTasks
    .filter(t => t.status === "pending" || t.status === "in_progress")
    .map(t => t.title.toLowerCase());

  const VALID_TYPES   = new Set<GrowthTaskType>(["content_idea","ab_test","improve_copy","fix_declining","new_opportunity","campaign","product_improve","repost","engagement"]);
  const VALID_PRIS    = new Set<GrowthTaskPriority>(["critical","high","medium","low"]);
  const VALID_MGRS    = new Set<MarketingManagerId>(["tiktok","instagram","youtube","x","linkedin","email","seo"]);

  const newTasks: GrowthTask[] = rawTasks
    .filter(t => {
      if (!t.title || !t.description) return false;
      // Skip if too similar to existing pending task
      const tLow = t.title.toLowerCase();
      return !pendingTitles.some(p => p.includes(tLow.slice(0, 20)) || tLow.includes(p.slice(0, 20)));
    })
    .slice(0, maxTasks)
    .map(t => ({
      id:              randomUUID(),
      reviewId,
      type:            VALID_TYPES.has(t.type as GrowthTaskType) ? (t.type as GrowthTaskType) : "content_idea",
      priority:        VALID_PRIS.has(t.priority as GrowthTaskPriority) ? (t.priority as GrowthTaskPriority) : "medium",
      status:          "pending" as const,
      title:           String(t.title).slice(0, 80),
      description:     String(t.description).slice(0, 400),
      reasoning:       String(t.reasoning ?? "").slice(0, 300),
      estimatedImpact: String(t.estimatedImpact ?? "").slice(0, 200),
      managerId:       t.managerId && VALID_MGRS.has(t.managerId as MarketingManagerId)
        ? (t.managerId as MarketingManagerId)
        : undefined,
      referenceAsset:  t.referenceAsset ?? undefined,
      suggestedAction: t.suggestedAction ?? undefined,
      createdAt:       now,
    }));

  /* ── Build GrowthReview ── */
  const review: GrowthReview = {
    id:             reviewId,
    type:           reviewType,
    runAt:          now,
    tasksGenerated: newTasks.length,
    summary:        parsed.summary ?? `${reviewType} growth review completed. ${newTasks.length} new tasks generated.`,
    topOpportunity: parsed.topOpportunity,
    topProblem:     parsed.topProblem,
    newTaskIds:     newTasks.map(t => t.id),
  };

  /* ── Merge + save ── */
  const mergedTasks: GrowthTask[] = [...existingTasks, ...newTasks];
  const mergedReviews: GrowthReview[] = [review, ...existingReviews].slice(0, 30); // keep 30 reviews max

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: {
        ...results,
        growthTasks:   mergedTasks,
        growthReviews: mergedReviews,
      },
      updatedAt: new Date(),
    })
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));

  return { review, newTasks };
}

/* ─── Update task status ─────────────────────────────────────────────────────── */

export async function updateGrowthTaskStatus(
  launchId:  string,
  userId:    string,
  taskId:    string,
  status:    "done" | "dismissed" | "in_progress",
): Promise<void> {
  const [row] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));

  if (!row) return;

  const results: LaunchStageResults = row.stageResults ?? {};
  const tasks = (results.growthTasks ?? []).map(t =>
    t.id === taskId
      ? { ...t, status, completedAt: (status === "done") ? new Date().toISOString() : undefined }
      : t
  );

  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, growthTasks: tasks }, updatedAt: new Date() })
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)));
}
