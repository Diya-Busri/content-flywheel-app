/**
 * Opportunity Radar — Phase 5
 *
 * Aggregates all business signals into one unified, scored feed:
 * - Agent discoveries (undismissed, last 7d)
 * - User recommendations (from intelligence engine, undismissed)
 * - Active user patterns (converted to opportunities)
 *
 * Scored by: confidence × 0.4 + (priority/10) × 0.4 + recency × 0.2
 * Returns the top N opportunities sorted by combined radar score.
 */

import { db } from "@/db/db";
import { agentDiscoveriesTable } from "@/db/schema/agent-discoveries-schema";
import { userRecommendationsTable } from "@/db/schema/user-recommendations-schema";
import { userPatternsTable } from "@/db/schema/user-patterns-schema";
import { eq, and, desc, gte } from "drizzle-orm";

export interface RadarSignal {
  id: string;
  source: "agent" | "intelligence" | "pattern";
  agentType?: string;
  signalType: "opportunity" | "warning" | "insight" | "recommendation" | "pattern";
  title: string;
  description: string | null;
  confidence: number;
  priority: number;
  radarScore: number;     // 0–1 combined score for sorting
  actionType?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  createdAt: string;
  canDismiss: boolean;
}

function recencyScore(dateStr: string, maxAgeDays = 7): number {
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
  return Math.max(0, 1 - ageDays / maxAgeDays);
}

function computeRadarScore(confidence: number, priority: number, createdAt: string): number {
  return (
    confidence * 0.4 +
    (priority / 10) * 0.4 +
    recencyScore(createdAt) * 0.2
  );
}

export async function getOpportunityRadar(
  userId: string,
  limit = 30,
): Promise<RadarSignal[]> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000);

  const [agentDiscoveries, intelligenceRecs, patterns] = await Promise.all([
    db.select()
      .from(agentDiscoveriesTable)
      .where(and(
        eq(agentDiscoveriesTable.userId, userId),
        eq(agentDiscoveriesTable.isDismissed, false),
        gte(agentDiscoveriesTable.createdAt, cutoff),
      ))
      .orderBy(desc(agentDiscoveriesTable.createdAt))
      .limit(40),

    db.select()
      .from(userRecommendationsTable)
      .where(and(
        eq(userRecommendationsTable.userId, userId),
        eq(userRecommendationsTable.isDismissed, false),
      ))
      .orderBy(desc(userRecommendationsTable.priority))
      .limit(15),

    db.select()
      .from(userPatternsTable)
      .where(and(
        eq(userPatternsTable.userId, userId),
        eq(userPatternsTable.isActive, true),
      ))
      .orderBy(desc(userPatternsTable.confidence))
      .limit(10),
  ]);

  const signals: RadarSignal[] = [];

  // Agent discoveries
  for (const d of agentDiscoveries) {
    const radarScore = computeRadarScore(d.confidence, d.priority, d.createdAt.toISOString());
    signals.push({
      id: d.id,
      source: "agent",
      agentType: d.agentType,
      signalType: d.discoveryType as RadarSignal["signalType"],
      title: d.title,
      description: d.description,
      confidence: d.confidence,
      priority: d.priority,
      radarScore,
      actionType: d.actionType,
      actionLabel: d.actionLabel,
      actionUrl: d.actionUrl,
      createdAt: d.createdAt.toISOString(),
      canDismiss: true,
    });
  }

  // Intelligence engine recommendations
  for (const r of intelligenceRecs) {
    const createdAt = new Date(Date.now() - 86_400_000).toISOString(); // estimate
    const radarScore = computeRadarScore(r.confidence, r.priority, createdAt);
    signals.push({
      id: r.id,
      source: "intelligence",
      signalType: "recommendation",
      title: r.title,
      description: r.description,
      confidence: r.confidence,
      priority: r.priority,
      radarScore,
      actionType: r.actionType,
      createdAt,
      canDismiss: true,
    });
  }

  // Active patterns (treated as persistent opportunities)
  for (const p of patterns) {
    const createdAt = p.firstDetectedAt?.toISOString() ?? new Date().toISOString();
    const radarScore = computeRadarScore(p.confidence, Math.round(p.confidence * 8 + 2), createdAt);
    signals.push({
      id: p.id,
      source: "pattern",
      signalType: "pattern",
      title: p.title,
      description: p.description,
      confidence: p.confidence,
      priority: Math.round(p.confidence * 8 + 2),
      radarScore,
      createdAt,
      canDismiss: false,
    });
  }

  // Sort by radar score and return top N
  return signals
    .sort((a, b) => b.radarScore - a.radarScore)
    .slice(0, limit);
}
