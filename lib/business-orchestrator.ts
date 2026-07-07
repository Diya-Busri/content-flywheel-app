/**
 * Business Orchestrator — Phase 5
 *
 * The "CEO layer" of Content Flywheel. Aggregates all signals (goals, health,
 * agent discoveries, patterns, activity) and generates a prioritised decision
 * queue — telling the user exactly what to do next and why.
 *
 * Also computes the Business Health Score across 7 dimensions.
 */

import OpenAI from "openai";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { userPatternsTable } from "@/db/schema/user-patterns-schema";
import { userIntelligenceTimelineTable } from "@/db/schema/user-intelligence-timeline-schema";
import { agentDiscoveriesTable } from "@/db/schema/agent-discoveries-schema";
import { agentRunsTable } from "@/db/schema/agent-runs-schema";
import { businessGoalsTable } from "@/db/schema/business-goals-schema";
import { orchestratorDecisionsTable } from "@/db/schema/orchestrator-decisions-schema";
import { eq, and, desc, gte, count, avg } from "drizzle-orm";
import { sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ORCHESTRATOR_RATE_LIMIT_HOURS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthDimension {
  key: string;
  name: string;
  score: number;     // 0–100
  label: "Excellent" | "Strong" | "Growing" | "Early" | "Needs attention";
  description: string;
}

export interface BusinessHealthScore {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: HealthDimension[];
  lastCalculatedAt: string;
}

export interface OrchestratorDecision {
  id: string;
  title: string;
  description: string | null;
  reasoning: string | null;
  priority: number;
  goalAlignment: string | null;
  isActioned: boolean;
  createdAt: string;
}

export interface OrchestratorState {
  healthScore: BusinessHealthScore;
  decisions: OrchestratorDecision[];
  lastRunAt: string | null;
  hoursUntilNextRun: number;
}

// ─── Health Score Calculation ─────────────────────────────────────────────────

function scoreToDimension(
  key: string,
  name: string,
  rawScore: number, // 0–1 float
  description: string,
): HealthDimension {
  const score = Math.min(100, Math.round(rawScore * 100));
  const label = score >= 85 ? "Excellent"
    : score >= 65 ? "Strong"
    : score >= 40 ? "Growing"
    : score >= 15 ? "Early"
    : "Needs attention";
  return { key, name, score, label, description };
}

export async function calculateHealthScore(userId: string): Promise<BusinessHealthScore> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);

  // Gather all signals in parallel
  const [
    categoryCounts,
    recentMemoryCount,
    avgConfidenceRows,
    activePatterns,
    recentAgentRuns,
    activeGoals,
    topDiscoveries,
    timelineRecent,
  ] = await Promise.all([
    // Memory distribution across categories
    db.select({ category: userMemoryTable.category, cnt: count() })
      .from(userMemoryTable)
      .where(eq(userMemoryTable.userId, userId))
      .groupBy(userMemoryTable.category),

    // Memories added in last 7 days
    db.select({ cnt: count() })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, userId), gte(userMemoryTable.createdAt, sevenDaysAgo))),

    // Average confidence score across all memories
    db.select({ avgConf: avg(userMemoryTable.confidenceScore) })
      .from(userMemoryTable)
      .where(eq(userMemoryTable.userId, userId)),

    // Active patterns count
    db.select({ cnt: count() })
      .from(userPatternsTable)
      .where(and(eq(userPatternsTable.userId, userId), eq(userPatternsTable.isActive, true))),

    // Agent runs in last 7 days (unique agent types)
    db.select({ agentType: agentRunsTable.agentType })
      .from(agentRunsTable)
      .where(and(
        eq(agentRunsTable.userId, userId),
        eq(agentRunsTable.status, "completed"),
        gte(agentRunsTable.startedAt, sevenDaysAgo),
      ))
      .groupBy(agentRunsTable.agentType),

    // Active goals with progress
    db.select({ target: businessGoalsTable.target, current: businessGoalsTable.current })
      .from(businessGoalsTable)
      .where(and(eq(businessGoalsTable.userId, userId), eq(businessGoalsTable.isActive, true))),

    // Undismissed discoveries in last 7 days
    db.select({ cnt: count() })
      .from(agentDiscoveriesTable)
      .where(and(
        eq(agentDiscoveriesTable.userId, userId),
        eq(agentDiscoveriesTable.isDismissed, false),
        gte(agentDiscoveriesTable.createdAt, sevenDaysAgo),
      )),

    // Timeline events in last 7 days
    db.select({ cnt: count() })
      .from(userIntelligenceTimelineTable)
      .where(and(
        eq(userIntelligenceTimelineTable.userId, userId),
        gte(userIntelligenceTimelineTable.createdAt, sevenDaysAgo),
      )),
  ]);

  const byCategory = Object.fromEntries(categoryCounts.map(r => [r.category, Number(r.cnt)]));
  const totalMemories = Object.values(byCategory).reduce((s, n) => s + n, 0);
  const recentCount = Number(recentMemoryCount[0]?.cnt ?? 0);
  const avgConf = Number(avgConfidenceRows[0]?.avgConf ?? 0.5);
  const patternCount = Number(activePatterns[0]?.cnt ?? 0);
  const agentTypesRun = new Set(recentAgentRuns.map(r => r.agentType)).size;
  const discoveryCount = Number(topDiscoveries[0]?.cnt ?? 0);
  const timelineCount = Number(timelineRecent[0]?.cnt ?? 0);

  // ── Dimension 1: Knowledge Depth ─────────────────────────────────────────
  // How comprehensive is the business brain?
  const knowledgeScore = Math.min(1, (
    Math.min(totalMemories / 30, 1.0) * 0.5 +   // 30 memories = full score
    Math.min(avgConf, 1.0) * 0.3 +
    Math.min(patternCount / 5, 1.0) * 0.2
  ));

  // ── Dimension 2: Content Consistency ─────────────────────────────────────
  // How regularly is content being created?
  const contentCount = byCategory.content ?? 0;
  const contentRecent = Math.min(recentCount / 5, 1.0); // 5 memories/week = great
  const contentConsistency = Math.min(1, (
    Math.min(contentCount / 15, 1.0) * 0.4 +
    contentRecent * 0.6
  ));

  // ── Dimension 3: Product Pipeline ─────────────────────────────────────────
  const productCount = byCategory.products ?? 0;
  const hasResearch = (byCategory.research ?? 0) > 0;
  const productPipeline = Math.min(1, (
    Math.min(productCount / 10, 1.0) * 0.6 +
    (hasResearch ? 0.2 : 0) +
    Math.min((byCategory.analytics ?? 0) / 5, 1.0) * 0.2
  ));

  // ── Dimension 4: Analytics Intelligence ──────────────────────────────────
  const analyticsCount = byCategory.analytics ?? 0;
  const analyticsIntelligence = Math.min(1, (
    Math.min(analyticsCount / 10, 1.0) * 0.5 +
    Math.min(patternCount / 5, 1.0) * 0.5
  ));

  // ── Dimension 5: Experiment Velocity ─────────────────────────────────────
  const experimentCount = byCategory.experiments ?? 0;
  const experimentVelocity = Math.min(1, (
    Math.min(experimentCount / 5, 1.0) * 0.6 +
    Math.min(discoveryCount / 10, 1.0) * 0.4
  ));

  // ── Dimension 6: AI Agent Activity ───────────────────────────────────────
  const agentActivity = Math.min(1, (
    (agentTypesRun / 6) * 0.7 +
    Math.min(timelineCount / 20, 1.0) * 0.3
  ));

  // ── Dimension 7: Goal Progress ────────────────────────────────────────────
  let goalProgress = 0.3; // baseline if no goals set
  if (activeGoals.length > 0) {
    const totalProgress = activeGoals.reduce((sum, g) => {
      return sum + Math.min(g.current / Math.max(g.target, 1), 1.0);
    }, 0);
    goalProgress = totalProgress / activeGoals.length;
  }

  const dimensions: HealthDimension[] = [
    scoreToDimension("knowledge", "Knowledge Depth", knowledgeScore,
      `${totalMemories} memories, ${patternCount} patterns`),
    scoreToDimension("content", "Content Consistency", contentConsistency,
      `${contentCount} content entries, ${recentCount} this week`),
    scoreToDimension("products", "Product Pipeline", productPipeline,
      `${productCount} products, ${byCategory.research ?? 0} research reports`),
    scoreToDimension("analytics", "Analytics Intelligence", analyticsIntelligence,
      `${analyticsCount} analytics entries, ${patternCount} patterns`),
    scoreToDimension("experiments", "Experiment Velocity", experimentVelocity,
      `${experimentCount} experiments, ${discoveryCount} new discoveries`),
    scoreToDimension("agents", "AI Agent Activity", agentActivity,
      `${agentTypesRun}/6 agents active this week`),
    scoreToDimension("goals", "Goal Progress", goalProgress,
      activeGoals.length > 0 ? `${activeGoals.length} active goals` : "No goals set"),
  ];

  // Weighted overall (goals and content weighted higher)
  const weights = [0.15, 0.20, 0.15, 0.12, 0.10, 0.13, 0.15];
  const overall = Math.round(
    dimensions.reduce((sum, dim, i) => sum + dim.score * (weights[i] ?? 0.14), 0),
  );

  const grade = overall >= 85 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : overall >= 35 ? "D" : "F";

  return { overall, grade, dimensions, lastCalculatedAt: new Date().toISOString() };
}

// ─── Rate limiting helper ─────────────────────────────────────────────────────

async function hoursSinceLastOrchestration(userId: string): Promise<number | null> {
  try {
    const rows = await db
      .select({ createdAt: orchestratorDecisionsTable.createdAt })
      .from(orchestratorDecisionsTable)
      .where(eq(orchestratorDecisionsTable.userId, userId))
      .orderBy(desc(orchestratorDecisionsTable.createdAt))
      .limit(1);
    if (!rows[0]) return null;
    return (Date.now() - new Date(rows[0].createdAt).getTime()) / 3_600_000;
  } catch { return null; }
}

// ─── Decision Generation ──────────────────────────────────────────────────────

async function generateDecisions(
  userId: string,
  health: BusinessHealthScore,
  forceRun = false,
): Promise<OrchestratorDecision[]> {
  const hoursSince = await hoursSinceLastOrchestration(userId);
  if (!forceRun && hoursSince !== null && hoursSince < ORCHESTRATOR_RATE_LIMIT_HOURS) {
    // Return cached decisions
    return db
      .select()
      .from(orchestratorDecisionsTable)
      .where(and(eq(orchestratorDecisionsTable.userId, userId), eq(orchestratorDecisionsTable.isActioned, false)))
      .orderBy(desc(orchestratorDecisionsTable.priority))
      .limit(5)
      .then(rows => rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  }

  // Gather context for GPT
  const [goals, discoveries, patterns, recentTimeline] = await Promise.all([
    db.select()
      .from(businessGoalsTable)
      .where(and(eq(businessGoalsTable.userId, userId), eq(businessGoalsTable.isActive, true)))
      .limit(5),

    db.select({ title: agentDiscoveriesTable.title, description: agentDiscoveriesTable.description, discoveryType: agentDiscoveriesTable.discoveryType, priority: agentDiscoveriesTable.priority, agentType: agentDiscoveriesTable.agentType })
      .from(agentDiscoveriesTable)
      .where(and(
        eq(agentDiscoveriesTable.userId, userId),
        eq(agentDiscoveriesTable.isDismissed, false),
        gte(agentDiscoveriesTable.createdAt, new Date(Date.now() - 7 * 86_400_000)),
      ))
      .orderBy(desc(agentDiscoveriesTable.priority))
      .limit(8),

    db.select({ title: userPatternsTable.title, description: userPatternsTable.description, confidence: userPatternsTable.confidence })
      .from(userPatternsTable)
      .where(and(eq(userPatternsTable.userId, userId), eq(userPatternsTable.isActive, true)))
      .orderBy(desc(userPatternsTable.confidence))
      .limit(4),

    db.select({ title: userIntelligenceTimelineTable.title, eventType: userIntelligenceTimelineTable.eventType })
      .from(userIntelligenceTimelineTable)
      .where(and(
        eq(userIntelligenceTimelineTable.userId, userId),
        gte(userIntelligenceTimelineTable.createdAt, new Date(Date.now() - 3 * 86_400_000)),
      ))
      .orderBy(desc(userIntelligenceTimelineTable.createdAt))
      .limit(6),
  ]);

  const goalContext = goals.length > 0
    ? goals.map(g => {
        const pct = Math.min(100, Math.round((g.current / Math.max(g.target, 1)) * 100));
        const daysLeft = g.deadline
          ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86_400_000)
          : null;
        return `- ${g.title}: ${pct}% (${g.current}/${g.target} ${g.unit})${daysLeft !== null ? `, ${daysLeft}d remaining` : ""}`;
      }).join("\n")
    : "No goals set yet.";

  const weakDimensions = health.dimensions
    .filter(d => d.score < 40)
    .map(d => `${d.name} (${d.score}/100 — ${d.description})`)
    .join(", ") || "None";

  const discoveryContext = discoveries.length > 0
    ? discoveries.map(d => `- [${d.agentType}/${d.discoveryType}] ${d.title}`).join("\n")
    : "No recent discoveries.";

  const patternContext = patterns.length > 0
    ? patterns.map(p => `- ${p.title}: ${p.description}`).join("\n")
    : "No patterns detected.";

  const prompt = `You are the Business Orchestrator for a digital creator's business. Your job is to act like a chief of staff — analysing the current business state and generating a short, prioritised list of the highest-impact next actions.

BUSINESS HEALTH SCORE: ${health.overall}/100 (Grade: ${health.grade})
WEAK AREAS: ${weakDimensions}

ACTIVE GOALS:
${goalContext}

LATEST DISCOVERIES FROM AGENTS:
${discoveryContext}

DETECTED PATTERNS:
${patternContext}

RECENT ACTIVITY:
${recentTimeline.map(e => `- ${e.eventType}: ${e.title}`).join("\n") || "No recent activity."}

Generate exactly 3-4 specific, actionable decisions. Each decision should:
1. Be directly tied to goals, weak areas, or high-priority discoveries
2. Include a clear explanation of WHY it's the most impactful thing to do right now
3. Specify which goal it advances (if any)
4. Be something the user can action TODAY

Respond ONLY with valid JSON:
{
  "decisions": [
    {
      "title": "specific action (max 80 chars, start with a verb)",
      "description": "2-3 sentences on exactly what to do",
      "reasoning": "1-2 sentences on why this is the highest-impact action right now",
      "priority": 1-10,
      "goalAlignment": "Which goal this advances (or null)"
    }
  ]
}`;

  interface DecisionPayload {
    title: string;
    description?: string;
    reasoning?: string;
    priority?: number;
    goalAlignment?: string | null;
  }

  let newDecisions: DecisionPayload[] = [];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 1000,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      decisions?: DecisionPayload[];
    };
    newDecisions = (parsed.decisions ?? []).slice(0, 4);
  } catch { /* use empty if GPT fails */ }

  if (newDecisions.length === 0) {
    return [];
  }

  // Clear old unactioned decisions, then insert new ones
  await db
    .delete(orchestratorDecisionsTable)
    .where(and(
      eq(orchestratorDecisionsTable.userId, userId),
      eq(orchestratorDecisionsTable.isActioned, false),
    ));

  const inserted = await db
    .insert(orchestratorDecisionsTable)
    .values(newDecisions.map(d => ({
      userId,
      title: d.title,
      description: d.description ?? null,
      reasoning: d.reasoning ?? null,
      priority: Math.min(10, Math.max(1, d.priority ?? 5)),
      goalAlignment: d.goalAlignment ?? null,
    })))
    .returning();

  return inserted.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// ─── Main Orchestrator Entry ──────────────────────────────────────────────────

export async function runOrchestrator(
  userId: string,
  forceRun = false,
): Promise<OrchestratorState> {
  const [health, hoursSince] = await Promise.all([
    calculateHealthScore(userId),
    hoursSinceLastOrchestration(userId),
  ]);

  const decisions = await generateDecisions(userId, health, forceRun);
  const hoursUntilNextRun = hoursSince === null ? 0
    : Math.max(0, ORCHESTRATOR_RATE_LIMIT_HOURS - hoursSince);

  return {
    healthScore: health,
    decisions,
    lastRunAt: hoursSince !== null
      ? new Date(Date.now() - hoursSince * 3_600_000).toISOString()
      : null,
    hoursUntilNextRun,
  };
}

// ─── Mark Decision Actioned ───────────────────────────────────────────────────

export async function markDecisionActioned(userId: string, decisionId: string): Promise<void> {
  await db
    .update(orchestratorDecisionsTable)
    .set({ isActioned: true })
    .where(and(
      eq(orchestratorDecisionsTable.id, decisionId),
      eq(orchestratorDecisionsTable.userId, userId),
    ));
}
