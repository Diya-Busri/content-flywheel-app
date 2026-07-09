/**
 * Research Agent
 *
 * Goal: Monitor research history, detect opportunities, surface new angles.
 * Rate limit: every 12 hours.
 * Data sources: user_memory (category: research)
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
} from "@/lib/agent-framework";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runResearchAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const log: string[] = [];
  const agentDef = AGENT_DEFINITIONS.research;

  // Rate limit check
  if (!ctx.forceRun) {
    const hours = await hoursSinceLastRun(ctx.userId, "research");
    if (hours !== null && hours < agentDef.rateLimitHours) {
      return {
        agentType: "research",
        discoveries: [], tasks: [],
        confidenceScore: 0,
        reasoningLog: [`Skipped: last run ${hours.toFixed(1)}h ago (limit ${agentDef.rateLimitHours}h)`],
        skipped: true,
        skipReason: `Next run in ${(agentDef.rateLimitHours - hours).toFixed(1)}h`,
      };
    }
  }

  log.push("Research Agent started");

  // Fetch research memories
  const memories = await db
    .select({
      title: userMemoryTable.title,
      aiSummary: userMemoryTable.aiSummary,
      content: userMemoryTable.content,
      usageCount: userMemoryTable.usageCount,
      updatedAt: userMemoryTable.updatedAt,
    })
    .from(userMemoryTable)
    .where(and(
      eq(userMemoryTable.userId, ctx.userId),
      eq(userMemoryTable.category, "research"),
    ))
    .orderBy(desc(userMemoryTable.updatedAt))
    .limit(15);

  log.push(`Found ${memories.length} research memories`);

  if (memories.length === 0) {
    return {
      agentType: "research",
      discoveries: [{
        discoveryType: "recommendation",
        title: "Run your first research report",
        description: "Use the Research tab to run your first market analysis. The Research Agent will start finding opportunities once you have some research history.",
        confidence: 1.0,
        priority: 8,
        actionType: "tab",
        actionLabel: "Open Research",
        actionUrl: "?tab=research",
      }],
      tasks: [{
        title: "Run a market research report",
        description: "Go to Workspace → Research and run your first niche analysis to activate the Research Agent.",
        priority: 8,
      }],
      confidenceScore: 0.9,
      reasoningLog: log,
    };
  }

  // Build context for GPT
  const memorySummary = memories
    .map((m, i) => {
      const text = m.aiSummary ?? m.content.slice(0, 300);
      const daysAgo = Math.floor((Date.now() - new Date(m.updatedAt).getTime()) / 86_400_000);
      return `${i + 1}. [${daysAgo}d ago] ${m.title}\n${text}`;
    })
    .join("\n\n");

  const oldestResearch = memories[memories.length - 1];
  const daysSinceOldest = Math.floor((Date.now() - new Date(oldestResearch!.updatedAt).getTime()) / 86_400_000);
  const recentCount = memories.filter(m => {
    const days = (Date.now() - new Date(m.updatedAt).getTime()) / 86_400_000;
    return days < 7;
  }).length;

  log.push(`${recentCount} entries in last 7 days, oldest is ${daysSinceOldest} days ago`);

  const prompt = `You are the Research Agent for a creator business platform. Analyse this user's research history and identify valuable opportunities.

RESEARCH HISTORY (${memories.length} entries):
${memorySummary}

CONTEXT:
- Entries researched in last 7 days: ${recentCount}
- Oldest research: ${daysSinceOldest} days ago

Your job: identify 2-3 specific, actionable discoveries:
- New research angles they haven't explored
- Repeated topics that signal a strong opportunity worth productising
- Topics last researched >7 days ago that may have shifted
- Gaps in their research (niches/topics adjacent to their existing work)

Also create 1-2 concrete tasks.

Respond ONLY with valid JSON:
{
  "discoveries": [
    {
      "discoveryType": "opportunity|warning|insight|recommendation",
      "title": "specific, actionable title (max 80 chars)",
      "description": "2-3 sentence explanation with clear next step",
      "confidence": 0.6-0.95,
      "priority": 1-10
    }
  ],
  "tasks": [
    {
      "title": "specific task title",
      "description": "exactly what to do",
      "priority": 1-10
    }
  ],
  "reasoning": "1 sentence explaining your overall analysis"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
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
    const avgConfidence = discoveries.length > 0
      ? discoveries.reduce((s, d) => s + d.confidence, 0) / discoveries.length
      : 0.5;

    return {
      agentType: "research",
      discoveries,
      tasks,
      confidenceScore: avgConfidence,
      reasoningLog: log,
    };
  } catch (err) {
    log.push(`GPT error: ${String(err)}`);
    return {
      agentType: "research",
      discoveries: [], tasks: [],
      confidenceScore: 0,
      reasoningLog: log,
    };
  }
}
