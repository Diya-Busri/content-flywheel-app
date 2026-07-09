/**
 * Business Coach Agent
 *
 * Goal: Monitor all activity, proactively surface risks, nudge and coach.
 * Rate limit: every 6 hours (most proactive agent).
 * Data sources: user_memory (all categories), user_intelligence_timeline, user_patterns
 */

import OpenAI from "openai";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { userIntelligenceTimelineTable } from "@/db/schema/user-intelligence-timeline-schema";
import { userPatternsTable } from "@/db/schema/user-patterns-schema";
import { eq, and, desc, gte, count } from "drizzle-orm";
import {
  type AgentContext,
  type AgentRunResult,
  AGENT_DEFINITIONS,
  hoursSinceLastRun,
} from "@/lib/agent-framework";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runCoachAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const log: string[] = [];

  if (!ctx.forceRun) {
    const hours = await hoursSinceLastRun(ctx.userId, "coach");
    if (hours !== null && hours < AGENT_DEFINITIONS.coach.rateLimitHours) {
      return {
        agentType: "coach",
        discoveries: [], tasks: [],
        confidenceScore: 0,
        reasoningLog: [`Skipped: ${hours.toFixed(1)}h since last run`],
        skipped: true,
        skipReason: `Next run in ${(AGENT_DEFINITIONS.coach.rateLimitHours - hours).toFixed(1)}h`,
      };
    }
  }

  log.push("Business Coach Agent started");

  const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000);
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);

  const [
    recentMemories,
    recentTimeline,
    patterns,
    categoryCountRows,
  ] = await Promise.all([
    // All recent activity
    db.select({
      category: userMemoryTable.category,
      title: userMemoryTable.title,
      source: userMemoryTable.source,
      updatedAt: userMemoryTable.updatedAt,
    })
      .from(userMemoryTable)
      .where(and(
        eq(userMemoryTable.userId, ctx.userId),
        gte(userMemoryTable.updatedAt, oneWeekAgo),
      ))
      .orderBy(desc(userMemoryTable.updatedAt))
      .limit(30),

    // Intelligence timeline (what's been happening)
    db.select({
      eventType: userIntelligenceTimelineTable.eventType,
      title: userIntelligenceTimelineTable.title,
      createdAt: userIntelligenceTimelineTable.createdAt,
    })
      .from(userIntelligenceTimelineTable)
      .where(and(
        eq(userIntelligenceTimelineTable.userId, ctx.userId),
        gte(userIntelligenceTimelineTable.createdAt, oneWeekAgo),
      ))
      .orderBy(desc(userIntelligenceTimelineTable.createdAt))
      .limit(20),

    // Active patterns
    db.select({
      title: userPatternsTable.title,
      description: userPatternsTable.description,
      confidence: userPatternsTable.confidence,
    })
      .from(userPatternsTable)
      .where(and(eq(userPatternsTable.userId, ctx.userId), eq(userPatternsTable.isActive, true)))
      .orderBy(desc(userPatternsTable.confidence))
      .limit(5),

    // Category breakdown
    db.select({
      category: userMemoryTable.category,
      count: count(),
    })
      .from(userMemoryTable)
      .where(eq(userMemoryTable.userId, ctx.userId))
      .groupBy(userMemoryTable.category),
  ]);

  log.push(`${recentMemories.length} activities this week, ${patterns.length} patterns`);

  // Check for inactivity
  const hasRecentContent = recentMemories.some(m =>
    m.category === "content" &&
    new Date(m.updatedAt).getTime() > threeDaysAgo.getTime(),
  );
  const hasRecentCoaching = recentMemories.some(m =>
    m.category === "coaching" &&
    new Date(m.updatedAt).getTime() > threeDaysAgo.getTime(),
  );
  const hasResearch = categoryCountRows.some(r => r.category === "research" && r.count > 0);
  const hasProducts = categoryCountRows.some(r => r.category === "products" && r.count > 0);
  const hasAnalytics = categoryCountRows.some(r => r.category === "analytics" && r.count > 0);

  const activitySummary = recentMemories
    .slice(0, 10)
    .map(m => `- [${m.category}] ${m.title} (${Math.floor((Date.now() - new Date(m.updatedAt).getTime()) / 86_400_000)}d ago)`)
    .join("\n");

  const timelineSummary = recentTimeline
    .slice(0, 8)
    .map(e => `- ${e.eventType}: ${e.title}`)
    .join("\n");

  const patternSummary = patterns
    .map(p => `- ${p.title}: ${p.description}`)
    .join("\n");

  const categoryBreakdown = categoryCountRows
    .map(r => `${r.category}: ${r.count}`)
    .join(", ");

  const inactivityFlags = [
    !hasRecentContent && "No content created in 3+ days",
    !hasRecentCoaching && "No coaching sessions in 3+ days",
    !hasResearch && "No research reports yet — missing market intelligence",
    hasResearch && !hasProducts && "You have research but no product ideas created yet",
    !hasAnalytics && "No analytics data tracked — can't measure what's working",
  ].filter(Boolean).join("\n");

  const prompt = `You are the Business Coach Agent for a digital creator. Your role is to monitor everything and proactively coach the user like a trusted business mentor.

ACTIVITY THIS WEEK (${recentMemories.length} events):
${activitySummary || "No activity this week."}

INTELLIGENCE TIMELINE:
${timelineSummary || "No timeline events."}

KNOWN PATTERNS:
${patternSummary || "No patterns detected yet."}

KNOWLEDGE BASE BREAKDOWN:
${categoryBreakdown || "Empty."}

INACTIVITY FLAGS:
${inactivityFlags || "None — user is active across all areas."}

Your job: Provide 2-4 honest, specific coaching observations:
- Call out specific gaps or inactivity without being preachy
- Celebrate specific wins or progress
- Identify strategic risks (e.g., "You've researched this topic 3 times but never built a product")
- Suggest the single most important next action

Be direct, specific, and like a coach who cares — not a generic chatbot.

Respond ONLY with valid JSON:
{
  "discoveries": [
    {
      "discoveryType": "opportunity|warning|insight|recommendation",
      "title": "honest, specific observation (max 80 chars)",
      "description": "2-3 sentences — direct, specific, actionable. Like a coach speaking.",
      "confidence": 0.7-0.95,
      "priority": 1-10
    }
  ],
  "tasks": [
    {
      "title": "single most important task",
      "description": "exactly what to do and why",
      "priority": 1-10
    }
  ],
  "reasoning": "1 sentence summarising your overall assessment"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 1000,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      discoveries?: AgentRunResult["discoveries"];
      tasks?: AgentRunResult["tasks"];
      reasoning?: string;
    };

    log.push(`GPT reasoning: ${parsed.reasoning ?? "n/a"}`);
    const discoveries = (parsed.discoveries ?? []).slice(0, 4);
    const tasks = (parsed.tasks ?? []).slice(0, 2);

    return {
      agentType: "coach",
      discoveries,
      tasks,
      confidenceScore: discoveries.length > 0
        ? discoveries.reduce((s, d) => s + d.confidence, 0) / discoveries.length
        : 0.5,
      reasoningLog: log,
    };
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    return { agentType: "coach", discoveries: [], tasks: [], confidenceScore: 0, reasoningLog: log };
  }
}
