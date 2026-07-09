/**
 * Experiment Agent
 *
 * Goal: Generate A/B experiments, track results, recommend winners.
 * Rate limit: every 24 hours.
 * Data sources: user_memory (category: experiments, content, analytics)
 */

import OpenAI from "openai";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { eq, and, desc } from "drizzle-orm";
import {
  type AgentContext,
  type AgentRunResult,
  AGENT_DEFINITIONS,
  hoursSinceLastRun,
  getRecentDiscoveries,
} from "@/lib/agent-framework";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runExperimentAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const log: string[] = [];

  if (!ctx.forceRun) {
    const hours = await hoursSinceLastRun(ctx.userId, "experiment");
    if (hours !== null && hours < AGENT_DEFINITIONS.experiment.rateLimitHours) {
      return {
        agentType: "experiment",
        discoveries: [], tasks: [],
        confidenceScore: 0,
        reasoningLog: [`Skipped: ${hours.toFixed(1)}h since last run`],
        skipped: true,
        skipReason: `Next run in ${(AGENT_DEFINITIONS.experiment.rateLimitHours - hours).toFixed(1)}h`,
      };
    }
  }

  log.push("Experiment Agent started");

  const [experimentMemories, contentMemories, analyticsDiscoveries] = await Promise.all([
    db.select({ title: userMemoryTable.title, aiSummary: userMemoryTable.aiSummary, content: userMemoryTable.content, updatedAt: userMemoryTable.updatedAt })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "experiments")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(8),

    db.select({ title: userMemoryTable.title, aiSummary: userMemoryTable.aiSummary })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "content")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(5),

    getRecentDiscoveries(ctx.userId, "analytics", 48),
  ]);

  log.push(`${experimentMemories.length} experiment memories, ${contentMemories.length} content memories`);

  const experimentSummary = experimentMemories
    .map((m, i) => `${i + 1}. ${m.title}: ${m.aiSummary?.slice(0, 150) ?? m.content.slice(0, 150)}`)
    .join("\n");

  const contentSummary = contentMemories
    .map(m => `- ${m.title}`)
    .join("\n");

  const analyticsInsights = analyticsDiscoveries
    .map(d => `- ${d.title}: ${d.description?.slice(0, 100) ?? ""}`)
    .join("\n");

  const prompt = `You are the Experiment Agent for a digital creator business. Design and track A/B experiments to continuously improve performance.

EXISTING EXPERIMENTS (${experimentMemories.length}):
${experimentSummary || "No experiments yet."}

RECENT CONTENT:
${contentSummary || "No content data."}

ANALYTICS INSIGHTS:
${analyticsInsights || "No recent analytics insights."}

Your job: Identify 2-3 high-value experiment opportunities:
- Hook A vs Hook B tests
- Pricing experiments (e.g., £19 vs £29)
- Thumbnail or cover image variations
- CTA copy tests ("Buy now" vs "Get instant access")
- Posting time experiments
- Format experiments (carousel vs static vs video)

If experiments exist, identify which ones have enough data to call a winner.

Create 1-2 experiment tasks.

Respond ONLY with valid JSON:
{
  "discoveries": [
    {
      "discoveryType": "opportunity|warning|insight|recommendation",
      "title": "specific experiment idea (max 80 chars)",
      "description": "what to test, the hypothesis, and how to measure success",
      "confidence": 0.6-0.95,
      "priority": 1-10
    }
  ],
  "tasks": [
    {
      "title": "task title",
      "description": "exactly how to set up the experiment",
      "priority": 1-10
    }
  ],
  "reasoning": "1 sentence summarising your experiment strategy"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 800,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      discoveries?: AgentRunResult["discoveries"];
      tasks?: AgentRunResult["tasks"];
      reasoning?: string;
    };

    log.push(`GPT reasoning: ${parsed.reasoning ?? "n/a"}`);
    const discoveries = (parsed.discoveries ?? []).slice(0, 3);
    const tasks = (parsed.tasks ?? []).slice(0, 2);

    return {
      agentType: "experiment",
      discoveries,
      tasks,
      confidenceScore: discoveries.length > 0
        ? discoveries.reduce((s, d) => s + d.confidence, 0) / discoveries.length
        : 0.5,
      reasoningLog: log,
    };
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    return { agentType: "experiment", discoveries: [], tasks: [], confidenceScore: 0, reasoningLog: log };
  }
}
