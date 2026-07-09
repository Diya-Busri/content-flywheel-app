/**
 * Analytics Agent
 *
 * Goal: Continuously surface performance patterns and auto-generate insights.
 * Rate limit: every 24 hours.
 * Data sources: user_memory (category: analytics), user_patterns
 */

import OpenAI from "openai";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { userPatternsTable } from "@/db/schema/user-patterns-schema";
import { eq, and, desc } from "drizzle-orm";
import {
  type AgentContext,
  type AgentRunResult,
  AGENT_DEFINITIONS,
  hoursSinceLastRun,
} from "@/lib/agent-framework";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runAnalyticsAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const log: string[] = [];

  if (!ctx.forceRun) {
    const hours = await hoursSinceLastRun(ctx.userId, "analytics");
    if (hours !== null && hours < AGENT_DEFINITIONS.analytics.rateLimitHours) {
      return {
        agentType: "analytics",
        discoveries: [], tasks: [],
        confidenceScore: 0,
        reasoningLog: [`Skipped: ${hours.toFixed(1)}h since last run`],
        skipped: true,
        skipReason: `Next run in ${(AGENT_DEFINITIONS.analytics.rateLimitHours - hours).toFixed(1)}h`,
      };
    }
  }

  log.push("Analytics Agent started");

  const [analyticsMemories, patterns] = await Promise.all([
    db.select({
      title: userMemoryTable.title,
      aiSummary: userMemoryTable.aiSummary,
      content: userMemoryTable.content,
      usageCount: userMemoryTable.usageCount,
      combinedScore: userMemoryTable.combinedScore,
      updatedAt: userMemoryTable.updatedAt,
    })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "analytics")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(12),

    db.select({
      title: userPatternsTable.title,
      description: userPatternsTable.description,
      confidence: userPatternsTable.confidence,
      patternType: userPatternsTable.patternType,
    })
      .from(userPatternsTable)
      .where(and(eq(userPatternsTable.userId, ctx.userId), eq(userPatternsTable.isActive, true)))
      .orderBy(desc(userPatternsTable.confidence))
      .limit(5),
  ]);

  log.push(`${analyticsMemories.length} analytics memories, ${patterns.length} active patterns`);

  if (analyticsMemories.length === 0 && patterns.length === 0) {
    return {
      agentType: "analytics",
      discoveries: [{
        discoveryType: "recommendation",
        title: "Connect your analytics data",
        description: "The Analytics Agent needs data to work with. Use your platform's analytics features and save key metrics to your Business Brain.",
        confidence: 1.0,
        priority: 6,
        actionType: "tab",
        actionLabel: "Open Workspace",
        actionUrl: "?tab=analytics",
      }],
      tasks: [],
      confidenceScore: 0.8,
      reasoningLog: log,
    };
  }

  const memorySummary = analyticsMemories
    .map((m, i) => `${i + 1}. ${m.title}: ${m.aiSummary?.slice(0, 200) ?? m.content.slice(0, 200)}`)
    .join("\n");

  const patternSummary = patterns.length > 0
    ? patterns.map(p => `- [${p.patternType}] ${p.title}: ${p.description}`).join("\n")
    : "No patterns detected yet.";

  const prompt = `You are the Analytics Agent for a digital creator business. Analyse performance data to surface actionable insights.

ANALYTICS DATA (${analyticsMemories.length} entries):
${memorySummary || "No analytics data yet."}

DETECTED PATTERNS:
${patternSummary}

Your job: Identify 2-3 high-value analytics insights:
- What's performing best and why
- What's underperforming and needs attention
- Specific metrics to focus on improving
- Patterns that should inform strategy

Create 1-2 data-driven tasks.

Respond ONLY with valid JSON:
{
  "discoveries": [
    {
      "discoveryType": "opportunity|warning|insight|recommendation",
      "title": "specific analytics insight (max 80 chars)",
      "description": "2-3 sentences with the finding and what to do about it",
      "confidence": 0.6-0.95,
      "priority": 1-10
    }
  ],
  "tasks": [
    {
      "title": "task title",
      "description": "specific action to take based on analytics",
      "priority": 1-10
    }
  ],
  "reasoning": "1 sentence summarising your analytics analysis"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
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
      agentType: "analytics",
      discoveries,
      tasks,
      confidenceScore: discoveries.length > 0
        ? discoveries.reduce((s, d) => s + d.confidence, 0) / discoveries.length
        : 0.5,
      reasoningLog: log,
    };
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    return { agentType: "analytics", discoveries: [], tasks: [], confidenceScore: 0, reasoningLog: log };
  }
}
