/**
 * lib/autonomous-orchestrator.ts — Phase 7.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Daily company cycle engine. Runs every department in sequence, logs every
 * action to activityFeed, and creates ApprovalItems for all generated content.
 * Generates a CEO briefing summarising the cycle.
 *
 * Department order: research → marketing → analytics → learning → memory → briefing
 *
 * Rules:
 *  1. Never start from scratch — always read existing stageResults first
 *  2. All content goes to approvalInbox, never auto-published
 *  3. Every step is logged to activityFeed with duration
 *  4. Best-effort: one department failure never stops the rest
 *  5. Activity feed capped at 500; approval inbox capped at 200
 */

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import { runMarketingManager } from "@/lib/marketing-managers";
import { runLearningCycle, buildTrends, mergeLessons } from "@/lib/learning-loop";
import { runGrowthReview } from "@/lib/growth-engine";
import type {
  LaunchStageResults,
  ActivityEvent,
  ApprovalItem,
  ApprovalItemType,
  CEOBriefing,
  AutonomousDepartment,
  AutonomousPhase,
  MarketingManagerId,
} from "@/db/schema/launch-schema";

const ai = new Anthropic();

/* ─── Constants ───────────────────────────────────────────────────────────────── */

const ACTIVITY_CAP  = 500;
const INBOX_CAP     = 200;

const MARKETING_MANAGERS: MarketingManagerId[] = [
  "tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo",
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function uid(): string {
  return randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** Prepend a new event to the feed and cap at ACTIVITY_CAP. */
export function logActivity(
  results: LaunchStageResults,
  event: Omit<ActivityEvent, "id" | "timestamp">,
): LaunchStageResults {
  const feed = results.activityFeed ?? [];
  const newEvent: ActivityEvent = { id: uid(), timestamp: now(), ...event };
  return {
    ...results,
    activityFeed: [newEvent, ...feed].slice(0, ACTIVITY_CAP),
  };
}

/** Prepend approval items and cap inbox at INBOX_CAP. */
function addToInbox(
  results: LaunchStageResults,
  items: ApprovalItem[],
): LaunchStageResults {
  const inbox = results.approvalInbox ?? [];
  return {
    ...results,
    approvalInbox: [...items, ...inbox].slice(0, INBOX_CAP),
  };
}

function makeApprovalItem(
  type: ApprovalItemType,
  department: AutonomousDepartment,
  title: string,
  preview: string,
  payload: Record<string, unknown>,
  managerId?: MarketingManagerId,
  batchSize?: number,
): ApprovalItem {
  return {
    id:          uid(),
    type,
    title,
    preview:     preview.slice(0, 200),
    department,
    managerId,
    status:      "pending",
    generatedAt: now(),
    payload,
    batchSize,
  };
}

/** Persist updated results + phase to DB. */
async function saveResults(
  launchId: string,
  userId: string,
  results: LaunchStageResults,
  phase: AutonomousPhase,
): Promise<void> {
  const mode = results.autonomousMode ?? {
    enabled: true,
    schedule: "daily",
    cycleCount: 0,
    currentPhase: phase,
  };
  await db
    .update(launchProjectsTable)
    .set({
      stageResults: {
        ...results,
        autonomousMode: { ...mode, currentPhase: phase },
      } as unknown as typeof launchProjectsTable.$inferInsert["stageResults"],
    })
    .where(
      and(
        eq(launchProjectsTable.id, launchId),
        eq(launchProjectsTable.userId, userId),
      ),
    );
}

/* ─── Context builders (reuse growth-engine patterns) ────────────────────────── */

function buildMemorySummary(results: LaunchStageResults): string {
  const mem = results.memory;
  if (!mem) return "No Business Memory yet.";
  const lines: string[] = [];
  if (mem.brandVoice) {
    lines.push(`Brand: ${mem.brandVoice.tone}. Values: ${mem.brandVoice.coreValues?.join(", ") ?? "none"}.`);
  }
  if (mem.targetAudience?.primaryAudience) {
    lines.push(`Audience: ${mem.targetAudience.primaryAudience}.`);
  }
  if (mem.facts && mem.facts.length > 0) {
    const top = mem.facts.slice(0, 5).map(f => `• ${f.fact}`).join("\n");
    lines.push(`Key facts:\n${top}`);
  }
  return lines.join("\n") || "No Business Memory yet.";
}

function buildAnalyticsSummary(results: LaunchStageResults): string {
  const dept = results.analyticsDept;
  if (!dept?.posts || dept.posts.length === 0) return "No analytics data yet.";
  const posts = dept.posts.slice(0, 10);
  return posts
    .map(p => `• [${p.platform}] "${p.metadata.hook?.slice(0, 60) ?? "no hook"}" — ${p.metrics.views ?? 0} views, ${p.metrics.likes ?? 0} likes`)
    .join("\n");
}

function buildLearningSummary(results: LaunchStageResults): string {
  const dept = results.analyticsDept;
  if (!dept?.lessons || dept.lessons.length === 0) return "No lessons yet.";
  return dept.lessons
    .slice(0, 5)
    .map(l => `• [${l.category}] ${l.lesson}`)
    .join("\n");
}

function buildProductSummary(results: LaunchStageResults): string {
  const name = results.product?.productName ?? results.research?.query ?? "the product";
  const desc = results.marketing?.salesCopy?.headline ?? "";
  return desc ? `${name} — ${desc}` : name;
}

/* ─── Department runners ─────────────────────────────────────────────────────── */

/** RESEARCH: Generate 3-5 new opportunities / questions based on existing context. */
async function runResearchDepartment(
  results: LaunchStageResults,
  launchId: string,
  userId: string,
): Promise<LaunchStageResults> {
  const t0 = Date.now();

  results = logActivity(results, {
    department: "research",
    action:     "Scanning existing knowledge for new opportunities",
    status:     "running",
  });
  await saveResults(launchId, userId, results, "research");

  try {
    const memory   = buildMemorySummary(results);
    const analytics = buildAnalyticsSummary(results);
    const lessons  = buildLearningSummary(results);
    const product  = buildProductSummary(results);

    const msg = await ai.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 1200,
      messages: [{
        role:    "user",
        content: `You are a research director for an AI company building "${product}".

EXISTING BUSINESS MEMORY:
${memory}

RECENT ANALYTICS:
${analytics}

LEARNING LOOP LESSONS:
${lessons}

Based ONLY on the above context (do not invent external data), generate 3-5 specific research insights or growth opportunities. Each insight must:
- Reference a specific observation from the data above
- Be actionable (what to test or investigate)
- Be framed as a question or hypothesis

Return JSON: {"insights": [{"title": string, "detail": string, "hypothesis": string}]}`,
      }],
    });

    const raw     = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const parsed  = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      insights?: Array<{ title: string; detail: string; hypothesis: string }>;
    };
    const insights = parsed.insights ?? [];

    if (insights.length > 0) {
      const items = insights.map(ins =>
        makeApprovalItem(
          "research",
          "research",
          ins.title,
          ins.detail,
          ins as Record<string, unknown>,
        ),
      );
      results = addToInbox(results, items);
    }

    const durationMs = Date.now() - t0;
    results = logActivity(results, {
      department: "research",
      action:     `Generated ${insights.length} research insight${insights.length !== 1 ? "s" : ""}`,
      detail:     insights.map(i => i.title).join(" · "),
      status:     "completed",
      durationMs,
    });
  } catch (err) {
    results = logActivity(results, {
      department: "research",
      action:     "Research scan failed",
      detail:     err instanceof Error ? err.message : String(err),
      status:     "failed",
      durationMs: Date.now() - t0,
    });
  }

  return results;
}

/** MARKETING: Run all 7 marketing managers, send output to approval inbox. */
async function runMarketingDepartment(
  results: LaunchStageResults,
  launchId: string,
  userId: string,
): Promise<LaunchStageResults> {
  results = logActivity(results, {
    department: "marketing",
    action:     "Starting all 7 marketing managers",
    status:     "running",
  });
  await saveResults(launchId, userId, results, "marketing");

  let generated = 0;

  for (const managerId of MARKETING_MANAGERS) {
    const t0 = Date.now();
    try {
      const result = await runMarketingManager(managerId, results);

      // Build preview from the first meaningful output field
      const outputKeys = Object.keys(result.output ?? {});
      const firstKey   = outputKeys[0];
      const firstVal   = firstKey ? (result.output as Record<string, unknown>)[firstKey] : undefined;
      const preview    = Array.isArray(firstVal)
        ? String((firstVal as unknown[])[0] ?? "").slice(0, 200)
        : String(firstVal ?? "").slice(0, 200);

      const item = makeApprovalItem(
        "content_batch",
        "marketing",
        `${managerId.charAt(0).toUpperCase() + managerId.slice(1)} content batch`,
        preview,
        result.output as Record<string, unknown>,
        managerId,
        outputKeys.length,
      );
      results = addToInbox(results, [item]);
      generated++;

      results = logActivity(results, {
        department: "marketing",
        action:     `${managerId} manager completed`,
        detail:     `Generated ${outputKeys.length} content piece${outputKeys.length !== 1 ? "s" : ""}`,
        status:     "completed",
        durationMs: Date.now() - t0,
        metadata:   { managerId, outputKeys },
      });
    } catch (err) {
      results = logActivity(results, {
        department: "marketing",
        action:     `${managerId} manager failed`,
        detail:     err instanceof Error ? err.message : String(err),
        status:     "failed",
        durationMs: Date.now() - t0,
        metadata:   { managerId },
      });
    }

    // Persist after each manager so progress is visible
    await saveResults(launchId, userId, results, "marketing");
  }

  results = logActivity(results, {
    department: "marketing",
    action:     `Marketing cycle complete — ${generated}/${MARKETING_MANAGERS.length} managers ran successfully`,
    status:     generated > 0 ? "completed" : "failed",
  });

  return results;
}

/** ANALYTICS: AI analysis of existing posts — skip if no posts. */
async function runAnalyticsDepartment(
  results: LaunchStageResults,
  launchId: string,
  userId: string,
): Promise<LaunchStageResults> {
  const posts = results.analyticsDept?.posts ?? [];
  const t0    = Date.now();

  if (posts.length === 0) {
    results = logActivity(results, {
      department: "analytics",
      action:     "Skipped — no posts to analyse yet",
      status:     "skipped",
    });
    return results;
  }

  results = logActivity(results, {
    department: "analytics",
    action:     `Analysing ${posts.length} published posts`,
    status:     "running",
  });
  await saveResults(launchId, userId, results, "analytics");

  try {
    const trends = buildTrends(posts);
    const trendSummary = trends
      .slice(0, 5)
      .map(t => `• ${t.managerId} — ${t.trend} (${t.dataPoints} data points)`)
      .join("\n") || "No trend data.";

    const msg = await ai.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 800,
      messages: [{
        role:    "user",
        content: `You are an analytics AI reviewing ${posts.length} published posts.

PLATFORM TRENDS:
${trendSummary}

TOP POSTS:
${posts.slice(0, 5).map(p => `• [${p.platform}] ${p.metrics.views ?? 0} views — hook: "${p.metadata.hook?.slice(0, 80) ?? "none"}"`).join("\n")}

Generate 2-3 specific analytics insights. Return JSON:
{"insights": [{"title": string, "finding": string, "recommendation": string}]}`,
      }],
    });

    const raw  = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      insights?: Array<{ title: string; finding: string; recommendation: string }>;
    };
    const insights = data.insights ?? [];

    if (insights.length > 0) {
      const item = makeApprovalItem(
        "research",
        "analytics",
        "Analytics intelligence report",
        insights[0]?.finding ?? "",
        { insights, trends: trends.slice(0, 5) },
      );
      results = addToInbox(results, [item]);
    }

    results = logActivity(results, {
      department: "analytics",
      action:     `Analytics complete — ${insights.length} insight${insights.length !== 1 ? "s" : ""} generated`,
      status:     "completed",
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    results = logActivity(results, {
      department: "analytics",
      action:     "Analytics failed",
      detail:     err instanceof Error ? err.message : String(err),
      status:     "failed",
      durationMs: Date.now() - t0,
    });
  }

  return results;
}

/** LEARNING: Run learning cycle if enough posts exist. */
async function runLearningDepartment(
  results: LaunchStageResults,
  launchId: string,
  userId: string,
): Promise<LaunchStageResults> {
  const posts = results.analyticsDept?.posts ?? [];
  const t0    = Date.now();

  if (posts.length < 3) {
    results = logActivity(results, {
      department: "learning",
      action:     `Skipped — need ≥ 3 posts, have ${posts.length}`,
      status:     "skipped",
    });
    return results;
  }

  results = logActivity(results, {
    department: "learning",
    action:     `Running learning cycle on ${posts.length} posts`,
    status:     "running",
  });
  await saveResults(launchId, userId, results, "learning");

  try {
    const existingLessons = results.analyticsDept?.lessons ?? [];
    const cycleResult     = await runLearningCycle(posts, results, existingLessons);
    const merged          = mergeLessons(existingLessons, cycleResult.lessons);

    // Update analyticsDept with new lessons
    results = {
      ...results,
      analyticsDept: {
        ...(results.analyticsDept ?? { posts: [], insights: [], lessons: [], trends: [] }),
        lessons: merged,
      },
    };

    const item = makeApprovalItem(
      "research",
      "learning",
      "Learning loop summary",
      cycleResult.todaysSummary.slice(0, 200),
      {
        summary:     cycleResult.todaysSummary,
        newLessons:  cycleResult.lessons,
        memoryFacts: cycleResult.memoryFacts,
      },
    );
    results = addToInbox(results, [item]);

    results = logActivity(results, {
      department: "learning",
      action:     `Learning cycle complete — ${cycleResult.lessons.length} new lesson${cycleResult.lessons.length !== 1 ? "s" : ""}`,
      detail:     cycleResult.todaysSummary,
      status:     "completed",
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    results = logActivity(results, {
      department: "learning",
      action:     "Learning cycle failed",
      detail:     err instanceof Error ? err.message : String(err),
      status:     "failed",
      durationMs: Date.now() - t0,
    });
  }

  return results;
}

/** MEMORY: Run growth review to surface new high-priority tasks. */
async function runMemoryDepartment(
  results: LaunchStageResults,
  launchId: string,
  userId: string,
): Promise<LaunchStageResults> {
  const t0 = Date.now();

  results = logActivity(results, {
    department: "memory",
    action:     "Updating Business Memory from this cycle",
    status:     "running",
  });
  await saveResults(launchId, userId, results, "memory");

  try {
    // Run growth review to synthesise everything into new actionable tasks
    const review   = await runGrowthReview(launchId, userId, "manual");
    const newTasks = review.tasks.filter(t => t.priority === "critical" || t.priority === "high");

    if (newTasks.length > 0) {
      const item = makeApprovalItem(
        "growth_task",
        "memory",
        `${newTasks.length} growth task${newTasks.length !== 1 ? "s" : ""} identified`,
        newTasks[0]?.title ?? "",
        { tasks: newTasks, reviewId: review.id },
        undefined,
        newTasks.length,
      );
      results = addToInbox(results, [item]);
    }

    results = logActivity(results, {
      department: "memory",
      action:     `Business Memory updated — ${newTasks.length} high-priority task${newTasks.length !== 1 ? "s" : ""} surfaced`,
      status:     "completed",
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    results = logActivity(results, {
      department: "memory",
      action:     "Memory update failed",
      detail:     err instanceof Error ? err.message : String(err),
      status:     "failed",
      durationMs: Date.now() - t0,
    });
  }

  return results;
}

/** BRIEFING: Generate CEO briefing summarising the entire cycle. */
async function generateCEOBriefing(
  results: LaunchStageResults,
  cycleNumber: number,
  cycleStarted: Date,
): Promise<LaunchStageResults> {
  const t0    = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const feed        = results.activityFeed ?? [];
  const inbox       = results.approvalInbox ?? [];
  const cycleEvents = feed.filter(e =>
    new Date(e.timestamp) >= cycleStarted,
  );

  const completedDepts = cycleEvents.filter(e => e.status === "completed");
  const failedDepts    = cycleEvents.filter(e => e.status === "failed");
  const pendingCount   = inbox.filter(i => i.status === "pending").length;
  const generated      = inbox.filter(i =>
    new Date(i.generatedAt) >= cycleStarted,
  ).length;

  // Aggregate per-department summary
  const DEPT_ORDER: AutonomousDepartment[] = ["research", "marketing", "analytics", "learning", "memory"];
  const deptSummaries = DEPT_ORDER.map(dept => {
    const events   = cycleEvents.filter(e => e.department === dept);
    const lastDone = events.filter(e => e.status === "completed").at(-1);
    const failed   = events.some(e => e.status === "failed");
    const skipped  = events.every(e => e.status === "skipped") || events.length === 0;

    return {
      name:       dept.charAt(0).toUpperCase() + dept.slice(1),
      department: dept,
      status:     (skipped ? "skipped" : failed && !lastDone ? "failed" : "completed") as "completed" | "failed" | "skipped",
      output:     lastDone?.action ?? (skipped ? "Skipped" : "No output"),
      itemCount:  inbox.filter(i => i.department === dept && new Date(i.generatedAt) >= cycleStarted).length,
    };
  });

  try {
    const product = buildProductSummary(results);
    const summary = deptSummaries
      .filter(d => d.status === "completed")
      .map(d => `${d.name}: ${d.output}`)
      .join(". ");

    const msg = await ai.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 600,
      messages: [{
        role:    "user",
        content: `You are a CEO briefing generator. The AI company running "${product}" just completed an autonomous cycle.

CYCLE SUMMARY:
${summary || "Cycle ran with minimal output."}
Items generated: ${generated}
Pending approvals: ${pendingCount}
Completed departments: ${completedDepts.length}
Failed: ${failedDepts.length}

Write a CEO briefing. Return JSON:
{"headline": string, "summary": string, "highlights": [string], "nextActions": [string]}

headline: "While you were away, your AI company did N things" style (max 80 chars)
summary: 2-3 sentence narrative of what happened
highlights: 3 top wins (array of strings)
nextActions: 2-3 things the CEO should do next (check inbox, approve content, etc.)`,
      }],
    });

    const raw    = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      headline?:    string;
      summary?:     string;
      highlights?:  string[];
      nextActions?: string[];
    };

    const briefing: CEOBriefing = {
      date:             today,
      cycleNumber,
      headline:         parsed.headline ?? `Cycle #${cycleNumber} complete`,
      summary:          parsed.summary  ?? summary,
      departments:      deptSummaries,
      itemsGenerated:   generated,
      itemsApproved:    inbox.filter(i => i.status === "approved" && new Date(i.reviewedAt ?? "0") >= cycleStarted).length,
      pendingApprovals: pendingCount,
      highlights:       parsed.highlights  ?? [],
      nextActions:      parsed.nextActions ?? ["Review your approval inbox"],
      generatedAt:      now(),
    };

    results = { ...results, ceoBriefing: briefing };
  } catch {
    // CEO briefing failure — build a minimal one from local data
    const briefing: CEOBriefing = {
      date:             today,
      cycleNumber,
      headline:         `Cycle #${cycleNumber} complete`,
      summary:          `The AI company ran ${completedDepts.length} successful department${completedDepts.length !== 1 ? "s" : ""}.`,
      departments:      deptSummaries,
      itemsGenerated:   generated,
      itemsApproved:    0,
      pendingApprovals: pendingCount,
      highlights:       completedDepts.slice(0, 3).map(e => e.action),
      nextActions:      ["Review your approval inbox"],
      generatedAt:      now(),
    };
    results = { ...results, ceoBriefing: briefing };
  }

  results = logActivity(results, {
    department: "system",
    action:     `CEO briefing generated for cycle #${cycleNumber}`,
    status:     "completed",
    durationMs: Date.now() - t0,
  });

  return results;
}

/* ─── Main export ─────────────────────────────────────────────────────────────── */

/**
 * runAutonomousCycle — run the full daily company cycle for a project.
 *
 * Sequence: research → marketing → analytics → learning → memory → briefing
 *
 * Each phase persists to DB on completion so the UI can show live progress.
 * Returns the final stageResults after all phases complete.
 */
export async function runAutonomousCycle(
  launchId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const cycleStarted = new Date();

  // ── Load project ──────────────────────────────────────────────────────────
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(
      and(
        eq(launchProjectsTable.id, launchId),
        eq(launchProjectsTable.userId, userId),
      ),
    );

  if (!project) return { ok: false, error: "Project not found" };

  let results = (project.stageResults ?? {}) as LaunchStageResults;

  const prevMode    = results.autonomousMode;
  const cycleNumber = (prevMode?.cycleCount ?? 0) + 1;

  // Mark as running
  results = {
    ...results,
    autonomousMode: {
      enabled:      prevMode?.enabled      ?? true,
      schedule:     prevMode?.schedule     ?? "daily",
      cycleCount:   cycleNumber,
      currentPhase: "research",
      lastRunAt:    cycleStarted.toISOString(),
      nextRunAt:    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  results = logActivity(results, {
    department: "system",
    action:     `Autonomous cycle #${cycleNumber} started`,
    detail:     `Running: research → marketing → analytics → learning → memory → briefing`,
    status:     "running",
  });

  await saveResults(launchId, userId, results, "research");

  // ── Department phases (best-effort) ───────────────────────────────────────
  try {
    results = await runResearchDepartment(results, launchId, userId);
    await saveResults(launchId, userId, results, "marketing");

    results = await runMarketingDepartment(results, launchId, userId);
    await saveResults(launchId, userId, results, "analytics");

    results = await runAnalyticsDepartment(results, launchId, userId);
    await saveResults(launchId, userId, results, "learning");

    results = await runLearningDepartment(results, launchId, userId);
    await saveResults(launchId, userId, results, "memory");

    results = await runMemoryDepartment(results, launchId, userId);
    await saveResults(launchId, userId, results, "briefing");

    results = await generateCEOBriefing(results, cycleNumber, cycleStarted);

    // Mark complete
    results = {
      ...results,
      autonomousMode: {
        ...results.autonomousMode!,
        currentPhase: "complete",
        lastRunAt:    cycleStarted.toISOString(),
      },
    };

    results = logActivity(results, {
      department: "system",
      action:     `Cycle #${cycleNumber} complete`,
      detail:     `${results.approvalInbox?.filter(i => i.status === "pending").length ?? 0} items waiting for approval`,
      status:     "completed",
      durationMs: Date.now() - cycleStarted.getTime(),
    });

    await saveResults(launchId, userId, results, "complete");
    return { ok: true };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    results = {
      ...results,
      autonomousMode: {
        ...results.autonomousMode!,
        currentPhase: "error",
        lastError:    message,
      },
    };

    results = logActivity(results, {
      department: "system",
      action:     `Cycle #${cycleNumber} failed`,
      detail:     message,
      status:     "failed",
      durationMs: Date.now() - cycleStarted.getTime(),
    });

    await saveResults(launchId, userId, results, "error");
    return { ok: false, error: message };
  }
}
