/**
 * Product Agent
 *
 * Goal: Identify product gaps, bundle opportunities, pricing recommendations.
 * Rate limit: every 24 hours.
 * Data sources: user_memory (category: products, research), recent research discoveries
 */

import OpenAI from "openai";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  type AgentContext,
  type AgentRunResult,
  AGENT_DEFINITIONS,
  hoursSinceLastRun,
  getRecentDiscoveries,
} from "@/lib/agent-framework";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runProductAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const log: string[] = [];

  if (!ctx.forceRun) {
    const hours = await hoursSinceLastRun(ctx.userId, "product");
    if (hours !== null && hours < AGENT_DEFINITIONS.product.rateLimitHours) {
      return {
        agentType: "product",
        discoveries: [], tasks: [],
        confidenceScore: 0,
        reasoningLog: [`Skipped: ${hours.toFixed(1)}h since last run`],
        skipped: true,
        skipReason: `Next run in ${(AGENT_DEFINITIONS.product.rateLimitHours - hours).toFixed(1)}h`,
      };
    }
  }

  log.push("Product Agent started");

  const [productMemories, researchMemories] = await Promise.all([
    db.select({
      title: userMemoryTable.title,
      aiSummary: userMemoryTable.aiSummary,
      content: userMemoryTable.content,
      updatedAt: userMemoryTable.updatedAt,
    })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "products")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(10),

    db.select({
      title: userMemoryTable.title,
      aiSummary: userMemoryTable.aiSummary,
    })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, ctx.userId), eq(userMemoryTable.category, "research")))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(5),
  ]);

  // Also check what Research Agent recently found
  const recentResearchDiscoveries = await getRecentDiscoveries(ctx.userId, "research", 48);

  log.push(`${productMemories.length} product memories, ${researchMemories.length} research memories`);

  const productSummary = productMemories.length > 0
    ? productMemories.map((m, i) => `${i + 1}. ${m.title}\n${m.aiSummary ?? m.content.slice(0, 200)}`).join("\n\n")
    : "No product memories yet.";

  const researchSummary = researchMemories.length > 0
    ? researchMemories.map(m => `- ${m.title}: ${m.aiSummary?.slice(0, 150) ?? ""}`).join("\n")
    : "No research history.";

  const researchOpportunities = recentResearchDiscoveries.length > 0
    ? recentResearchDiscoveries.map(d => `- ${d.title}`).join("\n")
    : "No recent research discoveries.";

  const prompt = `You are the Product Agent for a digital creator business. Analyse the user's product history and research to identify product opportunities.

EXISTING PRODUCTS/IDEAS (${productMemories.length}):
${productSummary}

RECENT RESEARCH:
${researchSummary}

OPPORTUNITIES FOUND BY RESEARCH AGENT:
${researchOpportunities}

Your job: Identify 2-3 specific product opportunities:
- Gaps: topics researched but no product created yet
- Bundle opportunities: 2+ existing products that could be packaged together
- Pricing: products that may be underpriced or overpriced relative to value
- New product ideas directly derived from the research

Create 1-2 actionable tasks.

Respond ONLY with valid JSON:
{
  "discoveries": [
    {
      "discoveryType": "opportunity|warning|insight|recommendation",
      "title": "specific product opportunity (max 80 chars)",
      "description": "2-3 sentences with specific action to take",
      "confidence": 0.6-0.95,
      "priority": 1-10
    }
  ],
  "tasks": [
    {
      "title": "task title",
      "description": "exactly what to do",
      "priority": 1-10
    }
  ],
  "reasoning": "1 sentence summarising your analysis"
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

    return {
      agentType: "product",
      discoveries,
      tasks,
      confidenceScore: discoveries.length > 0
        ? discoveries.reduce((s, d) => s + d.confidence, 0) / discoveries.length
        : 0.5,
      reasoningLog: log,
    };
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    return { agentType: "product", discoveries: [], tasks: [], confidenceScore: 0, reasoningLog: log };
  }
}
