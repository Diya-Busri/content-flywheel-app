/**
 * Agent Orchestrator — Phase 4
 *
 * Coordinates all AI agents: runs them in the correct order (respecting cross-agent
 * data flow), persists results, and generates the daily business brief.
 *
 * Agent collaboration pipeline:
 *   Research Agent → Product Agent → Content Agent (each reads previous discoveries)
 *   Analytics Agent → Experiment Agent (analytics informs experiments)
 *   Coach Agent (reads everything, runs last)
 */

import OpenAI from "openai";
import { db } from "@/db/db";
import { agentRunsTable } from "@/db/schema/agent-runs-schema";
import { agentDiscoveriesTable } from "@/db/schema/agent-discoveries-schema";
import { agentTasksTable } from "@/db/schema/agent-tasks-schema";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  type AgentType,
  type AgentRunResult,
  type AgentContext,
  AGENT_DEFINITIONS,
  getAgentPreferences,
  saveAgentDiscoveries,
  saveAgentTasks,
  startAgentRun,
  completeAgentRun,
  failAgentRun,
} from "@/lib/agent-framework";

import { runResearchAgent } from "@/lib/agents/research-agent";
import { runProductAgent } from "@/lib/agents/product-agent";
import { runContentAgent } from "@/lib/agents/content-agent";
import { runAnalyticsAgent } from "@/lib/agents/analytics-agent";
import { runExperimentAgent } from "@/lib/agents/experiment-agent";
import { runCoachAgent } from "@/lib/agents/coach-agent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrchestratorResult {
  results: AgentRunResult[];
  totalDiscoveries: number;
  totalTasks: number;
  agentsRun: AgentType[];
  agentsSkipped: AgentType[];
  durationMs: number;
}

export interface DailyBrief {
  date: string;
  headline: string;
  prioritiesHtml: string;
  discoveries: string[];
  tasks: string[];
  warnings: string[];
  opportunities: string[];
  businessHealth: number;   // 0-100
  generatedAt: string;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runAgent(
  agentType: AgentType,
  ctx: AgentContext,
): Promise<AgentRunResult> {
  const runId = await startAgentRun(ctx.userId, agentType);
  try {
    let result: AgentRunResult;
    switch (agentType) {
      case "research":   result = await runResearchAgent(ctx); break;
      case "product":    result = await runProductAgent(ctx); break;
      case "content":    result = await runContentAgent(ctx); break;
      case "analytics":  result = await runAnalyticsAgent(ctx); break;
      case "experiment": result = await runExperimentAgent(ctx); break;
      case "coach":      result = await runCoachAgent(ctx); break;
    }

    if (!result.skipped) {
      await Promise.all([
        saveAgentDiscoveries(ctx.userId, agentType, result.discoveries),
        saveAgentTasks(ctx.userId, agentType, result.tasks),
        completeAgentRun(runId, result),
      ]);
    } else {
      // Still mark the run as completed (skipped)
      await completeAgentRun(runId, { discoveries: [], tasks: [], reasoningLog: result.reasoningLog });
    }

    return result;
  } catch (err) {
    const errMsg = String(err);
    await failAgentRun(runId, errMsg);
    return {
      agentType,
      discoveries: [], tasks: [],
      confidenceScore: 0,
      reasoningLog: [`Fatal error: ${errMsg}`],
      skipped: true,
      skipReason: "Internal error",
    };
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function runAllAgents(
  userId: string,
  options: { isAdmin?: boolean; forceRun?: boolean; agentsToRun?: AgentType[] } = {},
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const { isAdmin = false, forceRun = false } = options;
  const ctx: AgentContext = { userId, isAdmin, forceRun };

  // Determine which agents to run
  const preferences = await getAgentPreferences(userId);
  const allAgents: AgentType[] = ["research", "product", "content", "analytics", "experiment", "coach"];
  const agentsToRun = (options.agentsToRun ?? allAgents).filter(a => preferences[a]);

  const results: AgentRunResult[] = [];
  const agentsRun: AgentType[] = [];
  const agentsSkipped: AgentType[] = [];

  // Phase 1: Research + Analytics (independent — run in parallel)
  const phase1: AgentType[] = ["research", "analytics"].filter(a => agentsToRun.includes(a as AgentType)) as AgentType[];
  if (phase1.length > 0) {
    const phase1Results = await Promise.all(phase1.map(a => runAgent(a, ctx)));
    phase1Results.forEach((r, i) => {
      results.push(r);
      if (r.skipped) agentsSkipped.push(phase1[i]!);
      else agentsRun.push(phase1[i]!);
    });
  }

  // Phase 2: Product + Experiment (depend on Research + Analytics respectively)
  const phase2: AgentType[] = ["product", "experiment"].filter(a => agentsToRun.includes(a as AgentType)) as AgentType[];
  if (phase2.length > 0) {
    const phase2Results = await Promise.all(phase2.map(a => runAgent(a, ctx)));
    phase2Results.forEach((r, i) => {
      results.push(r);
      if (r.skipped) agentsSkipped.push(phase2[i]!);
      else agentsRun.push(phase2[i]!);
    });
  }

  // Phase 3: Content (depends on Product)
  if (agentsToRun.includes("content")) {
    const contentResult = await runAgent("content", ctx);
    results.push(contentResult);
    if (contentResult.skipped) agentsSkipped.push("content");
    else agentsRun.push("content");
  }

  // Phase 4: Coach (reads everything — runs last)
  if (agentsToRun.includes("coach")) {
    const coachResult = await runAgent("coach", ctx);
    results.push(coachResult);
    if (coachResult.skipped) agentsSkipped.push("coach");
    else agentsRun.push("coach");
  }

  const totalDiscoveries = results.reduce((s, r) => s + r.discoveries.length, 0);
  const totalTasks = results.reduce((s, r) => s + r.tasks.length, 0);

  return {
    results,
    totalDiscoveries,
    totalTasks,
    agentsRun,
    agentsSkipped,
    durationMs: Date.now() - startTime,
  };
}

// ─── Daily Brief ──────────────────────────────────────────────────────────────

export async function generateDailyBrief(userId: string, isAdmin = false): Promise<DailyBrief> {
  // Force-run all agents for daily brief (bypass rate limits)
  const orchestratorResult = await runAllAgents(userId, { isAdmin, forceRun: true });

  // Collect all discoveries from the run + any undismissed from last 24h
  const last24h = new Date(Date.now() - 24 * 3_600_000);
  const allDiscoveries = await db
    .select()
    .from(agentDiscoveriesTable)
    .where(and(
      eq(agentDiscoveriesTable.userId, userId),
      eq(agentDiscoveriesTable.isDismissed, false),
      gte(agentDiscoveriesTable.createdAt, last24h),
    ))
    .orderBy(desc(agentDiscoveriesTable.priority))
    .limit(20);

  const allTasks = await db
    .select()
    .from(agentTasksTable)
    .where(and(eq(agentTasksTable.userId, userId), eq(agentTasksTable.status, "pending")))
    .orderBy(desc(agentTasksTable.priority))
    .limit(10);

  const opportunities = allDiscoveries.filter(d => d.discoveryType === "opportunity").map(d => d.title);
  const warnings = allDiscoveries.filter(d => d.discoveryType === "warning").map(d => d.title);
  const insights = allDiscoveries.filter(d => d.discoveryType === "insight" || d.discoveryType === "recommendation").map(d => d.title);
  const topTasks = allTasks.slice(0, 5).map(t => t.title);

  // Business health score: based on spread of activity, discovery count, agent confidence
  const activeAgents = orchestratorResult.agentsRun.length;
  const totalAgents = 6;
  const avgConfidence = orchestratorResult.results
    .filter(r => !r.skipped && r.confidenceScore > 0)
    .reduce((s, r, _, a) => s + r.confidenceScore / a.length, 0);
  const businessHealth = Math.min(100, Math.round(
    (activeAgents / totalAgents) * 40 +
    Math.min(allDiscoveries.length, 10) * 3 +
    avgConfidence * 30,
  ));

  // Generate brief with GPT-4o-mini
  const prompt = `Generate a morning business brief for a digital creator. Today is ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.

OPPORTUNITIES (${opportunities.length}): ${opportunities.slice(0, 3).join(" | ")}
WARNINGS (${warnings.length}): ${warnings.slice(0, 2).join(" | ")}
INSIGHTS: ${insights.slice(0, 3).join(" | ")}
TODAY'S TOP TASKS: ${topTasks.slice(0, 3).join(" | ")}
BUSINESS HEALTH: ${businessHealth}/100

Write:
1. A punchy 1-sentence headline for the day
2. A short paragraph (2-3 sentences) on today's priorities

Respond with valid JSON only:
{
  "headline": "exciting, specific 1-sentence day summary",
  "prioritiesHtml": "<p>today's priorities in 2-3 sentences. Be specific and direct.</p>"
}`;

  let headline = `Your AI agents have ${allDiscoveries.length} new discoveries today`;
  let prioritiesHtml = "<p>Review your agent discoveries and tackle today's priority tasks.</p>";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 300,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      headline?: string;
      prioritiesHtml?: string;
    };
    headline = parsed.headline ?? headline;
    prioritiesHtml = parsed.prioritiesHtml ?? prioritiesHtml;
  } catch { /* use defaults */ }

  return {
    date: new Date().toISOString().split("T")[0]!,
    headline,
    prioritiesHtml,
    discoveries: insights,
    tasks: topTasks,
    warnings,
    opportunities,
    businessHealth,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Single Agent Run ─────────────────────────────────────────────────────────

export async function runSingleAgent(
  userId: string,
  agentType: AgentType,
  options: { isAdmin?: boolean; forceRun?: boolean } = {},
): Promise<AgentRunResult> {
  const ctx: AgentContext = {
    userId,
    isAdmin: options.isAdmin ?? false,
    forceRun: options.forceRun ?? false,
  };
  return runAgent(agentType, ctx);
}
