/**
 * POST /api/projects/[launchId]/mission-control/run
 * ──────────────────────────────────────────────────────────────────────────────
 * CEO AI: reads the entire project state and generates a daily strategic plan.
 *
 * Answers three questions:
 *   1. What happened?    → briefing.yesterday
 *   2. What is happening now?  → briefing.today + current focus
 *   3. What should happen next? → tasks (specific instructions for each worker)
 *
 * Plan is cached by calendar date. Re-plan with { force: true }.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  MissionControlData,
  MissionFocus,
  MissionPlan,
  MissionTask,
  MissionBriefing,
  WorkerId,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

const ai = new Anthropic();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function parseJSON<T>(raw: string): T | null {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

/* ─── Context builders ───────────────────────────────────────────────────────── */

function buildContext(results: LaunchStageResults, goal: string): string {
  const r = results;
  const lines: string[] = [];

  lines.push(`BUSINESS GOAL: "${goal}"`);
  lines.push(`PRODUCT: "${r.product?.productName ?? "Not yet generated"}"`);

  if (r.store?.storeUrl) {
    lines.push(`STORE: Published at ${r.store.storeUrl} (readiness: ${r.store.readinessScore ?? "?"}%)`);
  } else if (r.store?.productId) {
    lines.push(`STORE: Draft built (not yet published, readiness: ${r.store.readinessScore ?? "?"}%)`);
  } else {
    lines.push("STORE: Not yet built");
  }

  if (r.brain) {
    lines.push(`BUSINESS BRAIN SCORES: Business ${r.brain.businessScore}/100, Launch ${r.brain.launchScore}/100`);
    const topRecs = (r.brain.recommendations ?? []).filter(rec => rec.priority === "high").slice(0, 3);
    if (topRecs.length) {
      lines.push("TOP BRAIN RECOMMENDATIONS:");
      topRecs.forEach(rec => lines.push(`  - [${rec.category}] ${rec.title}: ${rec.detail}`));
    }
  }

  if (r.growth?.report) {
    lines.push(`GROWTH HEALTH SCORE: ${r.growth.report.healthScore}/100`);
    const pending = (r.growth.aiTasks ?? []).filter(t => t.status === "pending").length;
    if (pending > 0) lines.push(`PENDING GROWTH TASKS: ${pending} unresolved`);
  } else {
    lines.push("GROWTH CHECK: Never run");
  }

  const m = r.marketing;
  if (m) {
    lines.push(`CONTENT ASSETS: TikTok hooks=${m.tiktokHooks?.length ?? 0}, Emails=${m.emails?.length ?? 0}, Carousels=${m.carousels?.length ?? 0}, X posts=${m.xPosts?.length ?? 0}, IG captions=${m.instagramCaptions?.length ?? 0}`);
  } else {
    lines.push("CONTENT ASSETS: None generated");
  }

  if (r.research?.keywords?.length) {
    lines.push(`KEYWORDS: ${r.research.keywords.slice(0, 5).map(k => k.term).join(", ")}`);
  }

  if (r.workforce?.workers) {
    lines.push("WORKER HISTORY (last activity per worker):");
    const ids: WorkerId[] = ["research", "product", "design", "marketing", "store", "growth"];
    for (const id of ids) {
      const w = r.workforce.workers[id];
      if (w?.lastActivity) {
        lines.push(`  - ${id}: "${w.lastActivity.label}" (${w.lastActivity.completedAt.slice(0, 10)})`);
      } else {
        lines.push(`  - ${id}: never run`);
      }
    }
  }

  return lines.join("\n");
}

function buildYesterdayContext(results: LaunchStageResults): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = yesterday.toISOString().slice(0, 10);

  const items: string[] = [];
  const workers = results.workforce?.workers ?? {};

  const ids: WorkerId[] = ["research", "product", "design", "marketing", "store", "growth"];
  for (const id of ids) {
    const w = workers[id];
    if (!w?.history) continue;
    for (const act of w.history) {
      if (act.completedAt.slice(0, 10) >= cutoff) {
        items.push(`${id} worker: ${act.label}`);
      }
    }
  }

  return items.length > 0
    ? items.slice(0, 6).join("; ")
    : "No worker activity since last brief";
}

/* ─── Plan generation ────────────────────────────────────────────────────────── */

async function generatePlan(
  results: LaunchStageResults,
  goal: string,
  previousPlanDates: string[],
): Promise<{ plan: MissionPlan; briefing: MissionBriefing }> {
  const context  = buildContext(results, goal);
  const recentActivity = buildYesterdayContext(results);

  const raw = await ai.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: `You are the CEO AI for a solo digital product creator. Your job is to review their business every day and assign specific, actionable work to their AI workers.

BUSINESS CONTEXT:
${context}

RECENT ACTIVITY (last 24h):
${recentActivity}

${previousPlanDates.length > 0 ? `PREVIOUS PLANS GENERATED ON: ${previousPlanDates.slice(0, 5).join(", ")} — do not repeat the same tasks.` : ""}

TODAY'S DATE: ${today()}

Generate a focused daily business plan. Choose the single most important strategic focus for today and assign 2-4 specific tasks to the relevant AI workers.

Return ONLY valid JSON:
{
  "focus": "launch|growth|optimisation|scaling|maintenance",
  "focusReason": "<1-2 sentences: why this is the right focus today, citing specific data from context>",
  "mission": "<short mission statement, e.g. 'Drive first 100 visitors'>",
  "missionReason": "<1 sentence: why this matters right now>",
  "tasks": [
    {
      "workerId": "research|product|design|marketing|store|growth",
      "workerLabel": "Research Worker|Product Worker|Design Worker|Marketing Worker|Store Worker|Growth Worker",
      "instruction": "<specific instruction for this worker — must be actionable and grounded in the business context above>",
      "reason": "<why this specific task matters today>",
      "priority": "high|medium|low"
    }
  ],
  "estimatedImpact": "<qualitative description of what completing all tasks will achieve>",
  "estimatedMinutes": 15,
  "briefing": {
    "greeting": "<opening sentence referencing what happened recently — specific, not generic>",
    "yesterday": ["<what was accomplished>", "<another thing completed>"],
    "today": ["<today's strategic direction>", "<secondary focus>"],
    "estimatedMinutes": 15
  }
}

Rules:
- Assign 2-4 tasks max (quality over quantity)
- Each instruction must be specific to this product — no generic "improve content"
- Reference real data from the context (score numbers, asset counts, etc.)
- yesterday array: list specific things completed recently (from RECENT ACTIVITY above). If nothing happened, say "No new work since last review."
- today array: 1-2 high-level strategic points about what the plan achieves
- Do not assign tasks to paused workers
- Focus on the highest-leverage action given the current stage`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    focus: MissionFocus;
    focusReason: string;
    mission: string;
    missionReason: string;
    tasks: Array<{
      workerId: WorkerId;
      workerLabel: string;
      instruction: string;
      reason: string;
      priority: "high" | "medium" | "low";
    }>;
    estimatedImpact: string;
    estimatedMinutes: number;
    briefing: {
      greeting: string;
      yesterday: string[];
      today: string[];
      estimatedMinutes: number;
    };
  }>(text);

  if (!data) throw new Error("Failed to parse Mission Control plan");

  const now      = new Date().toISOString();
  const dateStr  = today();

  const tasks: MissionTask[] = data.tasks.map(t => ({
    id:          uid(),
    workerId:    t.workerId,
    workerLabel: t.workerLabel,
    instruction: t.instruction,
    reason:      t.reason,
    priority:    t.priority,
    status:      "pending",
    assignedAt:  now,
  }));

  const plan: MissionPlan = {
    id:               uid(),
    date:             dateStr,
    focus:            data.focus,
    focusReason:      data.focusReason,
    mission:          data.mission,
    missionReason:    data.missionReason,
    tasks,
    estimatedImpact:  data.estimatedImpact,
    estimatedMinutes: data.estimatedMinutes,
    generatedAt:      now,
  };

  const briefing: MissionBriefing = {
    greeting:         data.briefing.greeting,
    yesterday:        data.briefing.yesterday,
    today:            data.briefing.today,
    estimatedMinutes: data.briefing.estimatedMinutes,
    date:             dateStr,
  };

  return { plan, briefing };
}

/* ─── Route handler ──────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId } = await params;
  const body = await req.json().catch(() => ({})) as { force?: boolean };

  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const mc      = results.missionControl ?? ({} as MissionControlData);

  /* Return cached plan if it's from today and not forced */
  if (!body.force && mc.currentPlan?.date === today()) {
    return NextResponse.json({ missionControl: mc, cached: true });
  }

  /* Generate fresh plan */
  const previousDates = (mc.planHistory ?? []).map(p => p.date);
  const { plan, briefing } = await generatePlan(results, project.goal, previousDates);

  /* Archive old plan to history (keep last 7) */
  const history = mc.currentPlan
    ? [mc.currentPlan, ...(mc.planHistory ?? [])].slice(0, 7)
    : (mc.planHistory ?? []);

  const updated: MissionControlData = {
    ...mc,
    focus:       plan.focus,
    currentPlan: plan,
    briefing,
    planHistory: history,
    lastRunAt:   new Date().toISOString(),
  };

  await db
    .update(launchProjectsTable)
    .set({
      stageResults: { ...results, missionControl: updated },
      updatedAt:    new Date(),
    })
    .where(eq(launchProjectsTable.id, launchId));

  return NextResponse.json({ missionControl: updated, cached: false });
}
