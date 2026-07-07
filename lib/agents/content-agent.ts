/**
 * Content Agent
 *
 * Goal: Build content plans, identify trending formats, recommend hooks and CTAs.
 * Rate limit: every 12 hours.
 * Data sources: user_memory (category: content, analytics, brand)
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

export async function runContentAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const log: string[] = [];

  if (!ctx.forceRun) {
    const hours = await hoursSinceLastRun(ctx.userId, "content");
    if (hours !== null && hours < AGENT_DEFINITIONS.content.rateLimitHours) {
      return {
        agentType: "content",
        discoveries: [], tasks: [],
        confidenceScore: 0,
        reasoningLog: [`Skipped: ${hours.toFixed(1)}h since last run`],
        skipped: true,
        skipReason: `Next run in ${(AGENT_DEFINITIONS.content.rateLimitHours - hours).toFixed(1)}h`,
      };
    }
  }

  log.push("Content Agent started");

  const [contentMemories, analyticsMemories, brandMemories, productDiscoveries] = await Promise.all([
    db.select({ title: userMemoryTable.title, aiSummary: userMemoryTable.aiSummary, content: userMemoryTable.content, updatedAt: userMemoryTable.updatedAt })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "content")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(10),

    db.select({ title: userMemoryTable.title, aiSummary: userMemoryTable.aiSummary })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "analytics")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(5),

    db.select({ title: userMemoryTable.title, content: userMemoryTable.content })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "brand")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(3),

    getRecentDiscoveries(ctx.userId, "product", 48),
  ]);

  log.push(`${contentMemories.length} content, ${analyticsMemories.length} analytics, ${brandMemories.length} brand memories`);

  const recentContent = contentMemories
    .map((m, i) => `${i + 1}. [${Math.floor((Date.now() - new Date(m.updatedAt).getTime()) / 86_400_000)}d ago] ${m.title}`)
    .join("\n");

  const analyticsContext = analyticsMemories
    .map(m => `- ${m.title}: ${m.aiSummary?.slice(0, 120) ?? ""}`)
    .join("\n");

  const brandContext = brandMemories.length > 0
    ? brandMemories.map(m => m.content.slice(0, 200)).join(" | ")
    : "No brand voice defined yet.";

  const newProducts = productDiscoveries.length > 0
    ? productDiscoveries.map(d => `- ${d.title}`).join("\n")
    : "No recent product ideas.";

  const prompt = `You are the Content Agent for a digital creator business. Analyse the user's content history and performance data to build a content strategy.

RECENT CONTENT (${contentMemories.length} entries):
${recentContent || "No content history yet."}

PERFORMANCE DATA:
${analyticsContext || "No analytics data yet."}

BRAND VOICE:
${brandContext}

PRODUCTS BEING WORKED ON (from Product Agent):
${newProducts}

Your job: Identify 2-3 specific content opportunities:
- Content ideas directly tied to their products and research
- Formats or hooks that are working vs. underused
- Posting cadence improvements
- Platform-specific recommendations

Create 1-2 concrete tasks.

Respond ONLY with valid JSON:
{
  "discoveries": [
    {
      "discoveryType": "opportunity|warning|insight|recommendation",
      "title": "specific content opportunity (max 80 chars)",
      "description": "2-3 sentences with specific content idea or strategy",
      "confidence": 0.6-0.95,
      "priority": 1-10
    }
  ],
  "tasks": [
    {
      "title": "task title",
      "description": "exactly what content to create",
      "priority": 1-10
    }
  ],
  "reasoning": "1 sentence summarising your content strategy analysis"
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
      agentType: "content",
      discoveries,
      tasks,
      confidenceScore: discoveries.length > 0
        ? discoveries.reduce((s, d) => s + d.confidence, 0) / discoveries.length
        : 0.5,
      reasoningLog: log,
    };
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    return { agentType: "content", discoveries: [], tasks: [], confidenceScore: 0, reasoningLog: log };
  }
}
