/**
 * POST /api/projects/[launchId]/growth-check
 * ──────────────────────────────────────────────────────────────────────────────
 * Daily AI growth check for a project.
 *
 * Reviews all stageResults + current goal → generates:
 *  - healthScore (0-100)
 *  - checks (store, content, SEO, brain, etc.)
 *  - aiTasks (4-5 specific tasks grounded in actual project data)
 *  - feed items (status observations)
 *  - nextAction (single most important thing to do)
 *
 * Results merged into stageResults.growth and saved to DB.
 * Cached: re-uses existing result if checked <23h ago (unless force=true).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { launchProjectsTable } from "@/db/schema/launch-schema";
import type { LaunchStageResults, GrowthData, GrowthReport, GrowthAITask, GrowthFeedItem } from "@/db/schema/launch-schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

const ai = new Anthropic();

/* ─── Prompt builder ─────────────────────────────────────────────────────────── */

function buildGrowthPrompt(results: LaunchStageResults, goal: string, projectGoal?: GrowthData["goal"]): string {
  const m = results.marketing;
  const s = results.store;
  const b = results.brain;

  const context = {
    goal,
    businessGoal: projectGoal ?? null,
    productName: results.product?.productName ?? null,
    storePublished: !!(s?.storeUrl),
    storeReadiness: s?.readinessScore ?? null,
    contentAssets: {
      tiktokHooks:        m?.tiktokHooks?.length       ?? 0,
      carousels:          m?.carousels?.length          ?? 0,
      emails:             m?.emails?.length             ?? 0,
      xPosts:             m?.xPosts?.length             ?? 0,
      instagramCaptions:  m?.instagramCaptions?.length  ?? 0,
      hasLaunchCopy:      !!m?.salesCopy,
      hasSEO:             !!(m?.seoTitle && m?.seoMetaDesc),
      hasFAQ:             !!(m?.faq?.length),
    },
    designAssets: {
      count: results.design?.assetsCount ?? 0,
      hasCover: !!(results.design?.coverUrl),
      hasMockup: !!(results.design?.mockupUrl),
    },
    brainScore:           b?.businessScore ?? null,
    brainLaunchScore:     b?.launchScore   ?? null,
    openRecommendations:  b?.recommendations?.filter(r => r.priority === "high").map(r => r.title) ?? [],
    researchKeywords:     results.research?.keywords?.slice(0, 5).map(k => k.term) ?? [],
    competitorCount:      results.research?.competitorInsights?.length ?? 0,
  };

  return `You are the AI growth operator for a creator's digital product business.

You are conducting a daily growth check. Your job is to generate specific, actionable work for this project.

PROJECT GOAL: "${goal}"
${projectGoal ? `BUSINESS TARGET: Reach ${projectGoal.target} ${projectGoal.unit} (currently at ${projectGoal.current})` : "No business goal set yet."}

PROJECT DATA:
${JSON.stringify(context, null, 2)}

RULES:
- Tasks MUST reference the actual product name and specific content from the data
- Never suggest tasks that are already complete (e.g., don't suggest "create marketing copy" if salesCopy exists)
- Health score reflects CURRENT state — penalise for unpublished store, low content count, ignored recommendations
- Feed items should be observations about THIS specific project, not generic tips
- Be direct and specific. "Generate 5 TikTok hooks about ${context.productName}" is good. "Create more content" is bad.
- Tasks should progress the business toward the goal

Return ONLY valid JSON:
{
  "healthScore": <integer 0-100>,
  "summary": "<2-3 sentences: specific status, what is working, biggest gap — reference actual product/content>",
  "checks": [
    { "id": "store_published",    "label": "Store published",          "status": "<ok|warning|missing>", "detail": "<specific detail>" },
    { "id": "content_volume",     "label": "Marketing content volume", "status": "<ok|warning|missing>", "detail": "<count and what's missing>" },
    { "id": "seo_complete",       "label": "SEO metadata complete",    "status": "<ok|warning|missing>", "detail": "<what's set or missing>" },
    { "id": "brain_applied",      "label": "Brain recommendations",    "status": "<ok|warning|missing>", "detail": "<open vs applied>" },
    { "id": "email_sequence",     "label": "Email sequence ready",     "status": "<ok|warning|missing>", "detail": "<count and status>" },
    { "id": "competitor_intel",   "label": "Competitor intelligence",  "status": "<ok|warning|missing>", "detail": "<when last analysed>" }
  ],
  "aiTasks": [
    {
      "id": "<unique-kebab-id>",
      "category": "<content|seo|store|marketing|product|analysis>",
      "title": "<specific imperative task using actual product name/content>",
      "detail": "<what exactly to do and why, referencing specific project data>",
      "priority": "<high|medium|low>",
      "actionHref": "<relevant page path>"
    }
  ],
  "feed": [
    {
      "id": "<unique-id>",
      "emoji": "<relevant emoji>",
      "text": "<specific observation about this project — use product name and real data>",
      "detail": "<optional extra context>",
      "category": "<insight|content|competitor|seo|store|improvement>"
    }
  ],
  "nextAction": {
    "label": "<single most important action, specific to this project>",
    "href": "<page path>",
    "priority": "high"
  }
}

Generate exactly 4-5 aiTasks and 3-4 feed items.`;
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

  /* Load project */
  const [project] = await db
    .select()
    .from(launchProjectsTable)
    .where(and(eq(launchProjectsTable.id, launchId), eq(launchProjectsTable.userId, userId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const results = project.stageResults ?? ({} as LaunchStageResults);
  const existing = results.growth ?? ({} as GrowthData);

  /* Cache: skip if checked within 23h and not forced */
  if (!body.force && existing.lastCheckedAt) {
    const age = Date.now() - new Date(existing.lastCheckedAt).getTime();
    if (age < 23 * 60 * 60 * 1000) {
      return NextResponse.json({ growth: existing, cached: true });
    }
  }

  /* Call Claude */
  let rawText = "";
  try {
    const msg = await ai.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{
        role:    "user",
        content: buildGrowthPrompt(results, project.goal, existing.goal),
      }],
    });
    rawText = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");
  } catch (err) {
    console.error("[growth-check] Claude error:", err);
    return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
  }

  /* Parse */
  let parsed: {
    healthScore: number;
    summary: string;
    checks: GrowthReport["checks"];
    aiTasks: Omit<GrowthAITask, "status" | "createdAt">[];
    feed: Omit<GrowthFeedItem, "timestamp">[];
    nextAction: GrowthReport["nextAction"];
  };

  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[growth-check] parse error:", err);
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  const now = new Date().toISOString();

  /* Preserve existing task statuses (done/skipped survive a re-check) */
  const existingTaskMap = Object.fromEntries(
    (existing.aiTasks ?? []).map(t => [t.id, t.status])
  );

  const aiTasks: GrowthAITask[] = (parsed.aiTasks ?? []).map(t => ({
    ...t,
    status:    existingTaskMap[t.id] ?? "pending",
    createdAt: now,
  }));

  const feed: GrowthFeedItem[] = (parsed.feed ?? []).map(f => ({
    ...f,
    href:      undefined,
    timestamp: now,
  }));

  const report: GrowthReport = {
    healthScore: parsed.healthScore,
    summary:     parsed.summary,
    checks:      parsed.checks,
    nextAction:  parsed.nextAction,
    generatedAt: now,
  };

  const growth: GrowthData = {
    ...existing,
    report,
    aiTasks,
    feed,
    lastCheckedAt: now,
  };

  /* Save */
  try {
    await db
      .update(launchProjectsTable)
      .set({ stageResults: { ...results, growth }, updatedAt: new Date() })
      .where(eq(launchProjectsTable.id, launchId));
  } catch (err) {
    console.error("[growth-check] DB save error:", err);
  }

  return NextResponse.json({ growth });
}
