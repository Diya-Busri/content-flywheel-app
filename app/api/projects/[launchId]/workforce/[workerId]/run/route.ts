/**
 * POST /api/projects/[launchId]/workforce/[workerId]/run
 * ──────────────────────────────────────────────────────────────────────────────
 * Executes a targeted micro-task for the given worker.
 *
 * Each worker reads existing project data, calls Claude for a specific output,
 * appends the result to the relevant stageResults field, and logs an activity.
 *
 * Workers NEVER regenerate from scratch — they always improve or extend.
 *
 * Worker behaviour:
 *  - research  → appends new keywords + competitor insights
 *  - marketing → generates new content for the lowest-count asset type
 *  - store     → rewrites SEO metadata or refreshes FAQs/CTAs
 *  - product   → generates improvement suggestions
 *  - design    → queues new design briefs (user executes separately)
 *  - growth    → re-runs the daily growth check
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type {
  LaunchStageResults,
  WorkerId,
  WorkerState,
  WorkerActivity,
  WorkforceData,
} from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { deriveNextTask } from "../route";

export const maxDuration = 120;

const ai = new Anthropic();

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function buildInitialWorker(): WorkerState {
  return { isPaused: false, isRunning: false, history: [] };
}

async function callClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const msg = await ai.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages:   [{ role: "user", content: prompt }],
  });
  return msg.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");
}

function parseJSON<T>(raw: string): T | null {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

/* ─── Worker runners ─────────────────────────────────────────────────────────── */

async function runResearch(results: LaunchStageResults, goal: string): Promise<{
  activity: Omit<WorkerActivity, "id" | "completedAt">;
  patch: Partial<LaunchStageResults>;
}> {
  const existing = {
    keywords:    results.research?.keywords?.map(k => k.term) ?? [],
    competitors: results.research?.competitorInsights?.map(c => c.name) ?? [],
    productName: results.product?.productName ?? goal,
  };

  const raw = await callClaude(`You are a market research analyst for a digital product creator.

PRODUCT: "${existing.productName}"
BUSINESS GOAL: "${goal}"
EXISTING KEYWORDS (do not duplicate): ${JSON.stringify(existing.keywords)}
KNOWN COMPETITORS (do not duplicate): ${JSON.stringify(existing.competitors)}

Generate NEW research insights not already in the data above.

Return ONLY valid JSON:
{
  "newKeywords": [
    { "term": "...", "intent": "...", "opportunity": "high|medium|low", "note": "<1 sentence why this term matters for this specific product>" }
  ],
  "newCompetitorInsights": [
    { "name": "...", "strength": "<what they do well>", "gap": "<opportunity this creator can exploit>" }
  ],
  "taskLabel": "<e.g. 'Found 4 keyword opportunities and 2 competitor gaps'>"
}

Rules:
- Return 3-5 new keywords and 1-2 new competitor insights
- Keywords must be specific to this product niche, not generic
- Do not repeat any existing keywords or competitors
- Note must reference the specific product`);

  const data = parseJSON<{
    newKeywords: Array<{ term: string; intent: string; opportunity: string; note: string }>;
    newCompetitorInsights: Array<{ name: string; strength: string; gap: string }>;
    taskLabel: string;
  }>(raw);

  if (!data) throw new Error("Failed to parse research output");

  const patch: Partial<LaunchStageResults> = {
    research: {
      ...(results.research ?? { insights: [], query: goal }),
      keywords: [
        ...(results.research?.keywords ?? []),
        ...data.newKeywords,
      ],
      competitorInsights: [
        ...(results.research?.competitorInsights ?? []),
        ...data.newCompetitorInsights,
      ],
    },
  };

  return {
    activity: {
      label:       data.taskLabel,
      detail:      `+${data.newKeywords.length} keywords · +${data.newCompetitorInsights.length} competitor insights`,
      assetsAdded: data.newKeywords.length + data.newCompetitorInsights.length,
    },
    patch,
  };
}

async function runMarketing(results: LaunchStageResults, goal: string): Promise<{
  activity: Omit<WorkerActivity, "id" | "completedAt">;
  patch: Partial<LaunchStageResults>;
}> {
  const m = results.marketing ?? {};
  const productName = results.product?.productName ?? goal;

  /* Pick lowest-count content type */
  const candidates = [
    { type: "tiktokHooks",       label: "TikTok hooks",       count: m.tiktokHooks?.length        ?? 0, n: 5 },
    { type: "emails",            label: "email sequences",    count: m.emails?.length              ?? 0, n: 2 },
    { type: "carousels",         label: "carousel posts",     count: m.carousels?.length           ?? 0, n: 3 },
    { type: "xPosts",            label: "X posts",            count: m.xPosts?.length              ?? 0, n: 5 },
    { type: "instagramCaptions", label: "Instagram captions", count: m.instagramCaptions?.length   ?? 0, n: 5 },
  ];
  const target = candidates.sort((a, b) => a.count - b.count)[0];

  let raw = "";
  let newItems: unknown[] = [];
  let taskLabel = "";

  if (target.type === "tiktokHooks" || target.type === "xPosts" || target.type === "instagramCaptions") {
    raw = await callClaude(`You are a social media content specialist.

PRODUCT: "${productName}"
GOAL: "${goal}"
PLATFORM: ${target.label}
EXISTING COUNT: ${target.count} (generate NEW ones, not duplicates)
${results.research?.keywords?.length ? `TOP KEYWORDS: ${results.research.keywords.slice(0, 4).map(k => k.term).join(", ")}` : ""}

Generate ${target.n} fresh, high-converting ${target.label} for "${productName}".

Return ONLY valid JSON:
{
  "items": ["...", "...", "..."],
  "taskLabel": "Generated ${target.n} new ${target.label} for ${productName}"
}`);
    const data = parseJSON<{ items: string[]; taskLabel: string }>(raw);
    if (!data) throw new Error("Parse failed");
    newItems = data.items;
    taskLabel = data.taskLabel;

    const key = target.type as "tiktokHooks" | "xPosts" | "instagramCaptions";
    const existing = (m[key] ?? []) as string[];
    (m as Record<string, unknown>)[key] = [...existing, ...data.items];

  } else if (target.type === "emails") {
    raw = await callClaude(`You are an email marketing specialist.

PRODUCT: "${productName}"
GOAL: "${goal}"
EXISTING EMAILS: ${target.count}

Generate 2 new marketing emails for "${productName}".

Return ONLY valid JSON:
{
  "emails": [
    { "name": "...", "subject": "...", "preview": "...", "body": "..." }
  ],
  "taskLabel": "Generated 2 new marketing emails"
}`);
    const data = parseJSON<{ emails: typeof m.emails; taskLabel: string }>(raw);
    if (!data) throw new Error("Parse failed");
    newItems = data.emails ?? [];
    taskLabel = data.taskLabel;
    m.emails = [...(m.emails ?? []), ...(data.emails ?? [])];

  } else if (target.type === "carousels") {
    raw = await callClaude(`You are a social media carousel specialist.

PRODUCT: "${productName}"
GOAL: "${goal}"
EXISTING CAROUSELS: ${target.count}

Generate 3 new carousel posts for "${productName}". Each carousel has a hook and 4-6 slide bullets.

Return ONLY valid JSON:
{
  "carousels": [
    { "hook": "...", "slides": ["slide 1", "slide 2", "slide 3", "slide 4"] }
  ],
  "taskLabel": "Generated 3 new carousel posts"
}`);
    const data = parseJSON<{ carousels: typeof m.carousels; taskLabel: string }>(raw);
    if (!data) throw new Error("Parse failed");
    newItems = data.carousels ?? [];
    taskLabel = data.taskLabel;
    m.carousels = [...(m.carousels ?? []), ...(data.carousels ?? [])];
  }

  return {
    activity: { label: taskLabel, assetsAdded: newItems.length },
    patch:    { marketing: m },
  };
}

async function runStore(results: LaunchStageResults, goal: string): Promise<{
  activity: Omit<WorkerActivity, "id" | "completedAt">;
  patch: Partial<LaunchStageResults>;
}> {
  const m = results.marketing ?? {};
  const s = results.store ?? {};
  const productName = results.product?.productName ?? goal;

  const raw = await callClaude(`You are an e-commerce SEO and conversion specialist.

PRODUCT: "${productName}"
GOAL: "${goal}"
CURRENT SEO TITLE: "${m.seoTitle ?? "not set"}"
CURRENT META DESC: "${m.seoMetaDesc ?? "not set"}"
CURRENT CTAs: ${JSON.stringify(m.ctas?.slice(0, 3) ?? [])}
CURRENT FAQs: ${m.faq?.length ?? 0} FAQs

Your job is to improve the store listing quality.

Return ONLY valid JSON:
{
  "seoTitle": "<improved SEO title — 50-60 chars, includes product name>",
  "seoMetaDesc": "<improved meta description — 140-155 chars, benefit-led>",
  "newCTAs": ["...", "...", "..."],
  "newFAQs": [
    { "q": "...", "a": "..." }
  ],
  "taskLabel": "<e.g. 'Improved SEO title, meta description, and added 2 FAQs'>"
}

Rules:
- SEO title must include the product name and main keyword
- Meta desc must lead with the primary benefit
- CTAs must be action-oriented and specific
- FAQs should address real buyer objections`);

  const data = parseJSON<{
    seoTitle: string;
    seoMetaDesc: string;
    newCTAs: string[];
    newFAQs: Array<{ q: string; a: string }>;
    taskLabel: string;
  }>(raw);

  if (!data) throw new Error("Parse failed");

  const updatedMarketing = {
    ...m,
    seoTitle:   data.seoTitle   || m.seoTitle,
    seoMetaDesc: data.seoMetaDesc || m.seoMetaDesc,
    ctas:  [...(m.ctas ?? []), ...data.newCTAs],
    faq:   [...(m.faq  ?? []), ...data.newFAQs],
  };

  return {
    activity: { label: data.taskLabel, assetsAdded: data.newCTAs.length + data.newFAQs.length },
    patch:    { marketing: updatedMarketing },
  };
}

async function runProduct(results: LaunchStageResults, goal: string): Promise<{
  activity: Omit<WorkerActivity, "id" | "completedAt">;
  workerPatch: Partial<import("@/db/schema/launch-schema").WorkerState>;
}> {
  const productName = results.product?.productName ?? goal;
  const salesCopy   = results.marketing?.salesCopy;
  const storeScore  = results.store?.readinessScore ?? 0;
  const brainIssues = results.brain?.sections;

  const raw = await callClaude(`You are a senior product strategist reviewing a digital product.

PRODUCT: "${productName}"
BUSINESS GOAL: "${goal}"
STORE READINESS: ${storeScore}/100
${salesCopy ? `CURRENT HEADLINE: "${salesCopy.headline}"` : "No sales copy yet."}
${brainIssues ? `KNOWN ISSUES FROM BRAIN REVIEW:
- Product: ${brainIssues.product?.issues?.join(", ") ?? "none noted"}
- Marketing: ${brainIssues.marketing?.issues?.join(", ") ?? "none noted"}
- Store: ${brainIssues.store?.issues?.join(", ") ?? "none noted"}` : ""}

Generate 3 specific, actionable improvements for this product.

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "area": "product|marketing|store|pricing",
      "priority": "high|medium|low",
      "detail": "<specific, actionable improvement — reference the actual product name and data>"
    }
  ],
  "taskLabel": "<e.g. 'Identified 3 improvements for Product Name'>"
}

Rules:
- Each suggestion must be specific to this product
- Reference real data (score, headline, etc.) where possible
- No generic advice`);

  const data = parseJSON<{
    suggestions: Array<{ area: string; priority: "high" | "medium" | "low"; detail: string }>;
    taskLabel: string;
  }>(raw);

  if (!data) throw new Error("Parse failed");

  const now = new Date().toISOString();
  const newSuggestions = data.suggestions.map(s => ({ ...s, id: uid(), addedAt: now }));

  return {
    activity: { label: data.taskLabel, assetsAdded: newSuggestions.length },
    workerPatch: { productSuggestions: newSuggestions },
  };
}

async function runDesign(results: LaunchStageResults, goal: string): Promise<{
  activity: Omit<WorkerActivity, "id" | "completedAt">;
  workerPatch: Partial<import("@/db/schema/launch-schema").WorkerState>;
}> {
  const productName = results.product?.productName ?? goal;
  const hasCovers   = !!(results.design?.coverUrl);
  const hasMockup   = !!(results.design?.mockupUrl);
  const hasSocial   = !!(results.design?.socialUrl);

  const raw = await callClaude(`You are a creative director for a digital product brand.

PRODUCT: "${productName}"
GOAL: "${goal}"
EXISTING ASSETS: cover=${hasCovers}, mockup=${hasMockup}, social=${hasSocial}

Generate 2 design briefs for new marketing visuals.

Return ONLY valid JSON:
{
  "briefs": [
    {
      "type": "thumbnail|social|cover|mockup",
      "description": "<what to show — specific, visual, referencing the product>",
      "style": "<art direction: color palette, mood, composition>"
    }
  ],
  "taskLabel": "<e.g. 'Briefed 2 new social graphic concepts'>"
}

Rules:
- Descriptions must be specific enough to generate from — not generic
- Vary the types (don't suggest two of the same)
- Reference the product name in descriptions`);

  const data = parseJSON<{
    briefs: Array<{ type: "thumbnail" | "social" | "cover" | "mockup"; description: string; style: string }>;
    taskLabel: string;
  }>(raw);

  if (!data) throw new Error("Parse failed");

  const now  = new Date().toISOString();
  const briefs = data.briefs.map(b => ({ ...b, id: uid(), queuedAt: now }));

  return {
    activity:    { label: data.taskLabel, assetsAdded: briefs.length },
    workerPatch: { designBriefs: briefs },
  };
}

async function runGrowth(launchId: string, userId: string): Promise<{
  activity: Omit<WorkerActivity, "id" | "completedAt">;
}> {
  /* Re-use the existing growth-check endpoint internally */
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projects/${launchId}/growth-check`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-internal-user-id": userId },
    body:    JSON.stringify({ force: true }),
  });

  if (!res.ok) throw new Error("Growth check failed");
  const json = await res.json() as { growth: { report?: { healthScore: number } } };
  const score = json.growth?.report?.healthScore ?? 0;

  return {
    activity: {
      label:  `Ran growth check — health score ${score}/100`,
      detail: "Updated AI tasks and growth feed",
    },
  };
}

/* ─── Route handler ──────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ launchId: string; workerId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { launchId, workerId } = await params;
  const wid = workerId as WorkerId;

  const VALID: WorkerId[] = ["research", "product", "design", "marketing", "store", "growth"];
  if (!VALID.includes(wid)) return NextResponse.json({ error: "Invalid worker" }, { status: 400 });

  /* Load project */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results   = project.stageResults ?? ({} as LaunchStageResults);
  const workforce = results.workforce ?? { workers: {} };
  const worker    = workforce.workers[wid] ?? buildInitialWorker();

  /* Guard: don't run paused or already-running workers */
  if (worker.isPaused) return NextResponse.json({ error: "Worker is paused" }, { status: 409 });
  if (worker.isRunning) return NextResponse.json({ error: "Worker is already running" }, { status: 409 });

  /* Mark as running */
  worker.isRunning  = true;
  worker.currentTask = deriveNextTask(wid, results);
  workforce.workers[wid] = worker;
  await db
    .update(launchProjectsTable)
    .set({ stageResults: { ...results, workforce }, updatedAt: new Date() })
    .where(eq(launchProjectsTable.id, launchId));

  /* Execute the worker */
  try {
    const now = new Date().toISOString();
    let newResults = { ...results };
    let activity: WorkerActivity;

    if (wid === "research") {
      const out = await runResearch(results, project.goal);
      newResults = { ...results, ...out.patch };
      activity = { id: uid(), completedAt: now, ...out.activity };

    } else if (wid === "marketing") {
      const out = await runMarketing(results, project.goal);
      newResults = { ...results, ...out.patch };
      activity = { id: uid(), completedAt: now, ...out.activity };

    } else if (wid === "store") {
      const out = await runStore(results, project.goal);
      newResults = { ...results, ...out.patch };
      activity = { id: uid(), completedAt: now, ...out.activity };

    } else if (wid === "product") {
      const out = await runProduct(results, project.goal);
      activity = { id: uid(), completedAt: now, ...out.activity };
      worker.productSuggestions = [
        ...(out.workerPatch.productSuggestions ?? []),
        ...(worker.productSuggestions ?? []),
      ].slice(0, 10);

    } else if (wid === "design") {
      const out = await runDesign(results, project.goal);
      activity = { id: uid(), completedAt: now, ...out.activity };
      worker.designBriefs = [
        ...(out.workerPatch.designBriefs ?? []),
        ...(worker.designBriefs ?? []),
      ].slice(0, 10);

    } else {
      /* growth */
      const out = await runGrowth(launchId, userId);
      activity = { id: uid(), completedAt: now, ...out.activity };
      /* Growth check already saved its own results — reload */
      const [fresh] = await db
        .select({ stageResults: launchProjectsTable.stageResults })
        .from(launchProjectsTable)
        .where(eq(launchProjectsTable.id, launchId))
        .limit(1);
      if (fresh?.stageResults) newResults = fresh.stageResults as LaunchStageResults;
    }

    /* Update worker state */
    worker.isRunning    = false;
    worker.lastRunAt    = now;
    worker.currentTask  = undefined;
    worker.lastActivity = activity;
    worker.nextTask     = deriveNextTask(wid, newResults);
    worker.history      = [activity, ...(worker.history ?? [])].slice(0, 20);

    /* Reload workforce from fresh results (growth may have saved it) */
    const freshWorkforce = newResults.workforce ?? workforce;
    freshWorkforce.workers[wid] = worker;

    await db
      .update(launchProjectsTable)
      .set({
        stageResults: { ...newResults, workforce: freshWorkforce },
        updatedAt:    new Date(),
      })
      .where(eq(launchProjectsTable.id, launchId));

    return NextResponse.json({ worker, activity });

  } catch (err) {
    /* Reset running flag on error */
    worker.isRunning   = false;
    worker.currentTask = undefined;
    workforce.workers[wid] = worker;
    await db
      .update(launchProjectsTable)
      .set({ stageResults: { ...results, workforce }, updatedAt: new Date() })
      .where(eq(launchProjectsTable.id, launchId));

    console.error(`[workforce/${wid}]`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function buildInitialWorker(): WorkerState {
  return { isPaused: false, isRunning: false, history: [] };
}
