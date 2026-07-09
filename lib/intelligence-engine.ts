/**
 * AI Intelligence Engine — Phase 3
 *
 * Continuously analyses, connects, ranks, and improves knowledge over time.
 * Runs automatically in the background after every memory save.
 *
 * Pipeline:
 *   Save memory → Score update → Duplicate check → Related links
 *               → Pattern detection (rate-limited) → Recommendations (rate-limited)
 *               → Timeline event
 */

import OpenAI from "openai";
import { client, db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { userPatternsTable } from "@/db/schema/user-patterns-schema";
import { userRecommendationsTable } from "@/db/schema/user-recommendations-schema";
import { userIntelligenceTimelineTable } from "@/db/schema/user-intelligence-timeline-schema";
import { eq, and, desc, lt, gt, count, sql } from "drizzle-orm";
import { generateMemoryEmbedding } from "@/lib/user-memory";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Compute a combined intelligence score (0–1) for a memory entry.
 * Weights: importance 25%, recency 20%, usage 20%, confidence 20%, performance 15%
 */
export function computeCombinedScore(memory: {
  importanceScore: number;
  performanceScore: number;
  confidenceScore: number;
  usageCount: number;
  updatedAt: Date | string;
}): number {
  const ageDays = (Date.now() - new Date(memory.updatedAt).getTime()) / 86_400_000;
  const recency = 1 / (1 + ageDays * 0.07); // halves every ~14 days
  const usageNorm = Math.min(memory.usageCount / 10, 1.0);
  return (
    memory.importanceScore  * 0.25 +
    recency                 * 0.20 +
    usageNorm               * 0.20 +
    memory.confidenceScore  * 0.20 +
    memory.performanceScore * 0.15
  );
}

/** Batch-update combined_score for all of a user's memories. */
export async function updateMemoryScores(userId: string): Promise<void> {
  try {
    // Fetch lightweight rows (no content/embedding)
    const rows = await client.unsafe(
      `SELECT id, importance_score, performance_score, confidence_score, usage_count, updated_at
       FROM user_memory WHERE user_id = $1`,
      [userId]
    ) as { id: string; importance_score: number; performance_score: number; confidence_score: number; usage_count: number; updated_at: string }[];

    // Build CASE statement for batch update
    if (rows.length === 0) return;
    const cases = rows
      .map(r => {
        const score = computeCombinedScore({
          importanceScore: r.importance_score,
          performanceScore: r.performance_score,
          confidenceScore: r.confidence_score,
          usageCount: r.usage_count,
          updatedAt: r.updated_at,
        });
        return `WHEN id = '${r.id}' THEN ${score.toFixed(4)}::REAL`;
      })
      .join(" ");

    await client.unsafe(
      `UPDATE user_memory SET combined_score = CASE ${cases} END WHERE user_id = $1`,
      [userId]
    );
  } catch (err) {
    console.warn("[intelligence] score update failed:", err);
  }
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

/**
 * Check if an embedding is too similar to an existing memory.
 * Returns the ID of the duplicate if found, null otherwise.
 */
export async function checkForDuplicate(
  userId: string,
  embedding: number[],
  threshold = 0.92
): Promise<string | null> {
  try {
    const embeddingLiteral = `[${embedding.join(",")}]`;
    const rows = await client.unsafe(
      `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
       FROM user_memory
       WHERE user_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [embeddingLiteral, userId]
    ) as { id: string; similarity: number }[];

    const top = rows[0];
    if (top && Number(top.similarity) >= threshold) return String(top.id);
    return null;
  } catch (err) {
    console.warn("[intelligence] duplicate check failed:", err);
    return null;
  }
}

/**
 * Merge new content into an existing memory entry.
 * Expands content, updates confidence (weighted average), re-embeds.
 */
export async function mergeIntoExisting(
  existingId: string,
  newTitle: string,
  newContent: string,
  newConfidence = 1.0
): Promise<void> {
  try {
    // Fetch existing
    const [existing] = await db
      .select()
      .from(userMemoryTable)
      .where(eq(userMemoryTable.id, existingId))
      .limit(1);

    if (!existing) return;

    // Blend: keep existing title, append new content if meaningfully different
    const mergedContent = existing.content.length < 3000
      ? `${existing.content}\n\n---\n${newContent}`.slice(0, 4000)
      : existing.content;

    // Weighted confidence: existing gets 2/3 weight (more established)
    const mergedConfidence = existing.confidenceScore * 0.67 + newConfidence * 0.33;

    await db.update(userMemoryTable)
      .set({
        content: mergedContent,
        confidenceScore: mergedConfidence,
        usageCount: existing.usageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(userMemoryTable.id, existingId));

    // Re-embed the merged entry async
    const { enrichUserMemoryEntry } = await import("@/lib/user-memory");
    void enrichUserMemoryEntry(existingId, existing.title, mergedContent).catch(() => {});
  } catch (err) {
    console.warn("[intelligence] merge failed:", err);
  }
}

// ─── Related Memories ─────────────────────────────────────────────────────────

/**
 * Find the top related memories for a given entry and persist the links.
 */
export async function linkRelatedMemories(
  userId: string,
  memoryId: string,
  embedding: number[],
  limit = 5
): Promise<void> {
  try {
    const embeddingLiteral = `[${embedding.join(",")}]`;
    const rows = await client.unsafe(
      `SELECT id FROM user_memory
       WHERE user_id = $1 AND id != $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $3::vector
       LIMIT $4`,
      [userId, memoryId, embeddingLiteral, limit]
    ) as { id: string }[];

    const ids = rows.map(r => String(r.id));
    if (ids.length > 0) {
      await client.unsafe(
        `UPDATE user_memory SET related_memory_ids = $1::text[] WHERE id = $2`,
        [ids, memoryId]
      );
    }
  } catch (err) {
    console.warn("[intelligence] link related failed:", err);
  }
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

const PATTERN_RATE_LIMIT_HOURS = 6;
const RECS_RATE_LIMIT_HOURS = 24;
const MIN_MEMORIES_FOR_PATTERNS = 3;

async function lastEventAge(userId: string, eventType: string): Promise<number> {
  const rows = await db
    .select({ createdAt: userIntelligenceTimelineTable.createdAt })
    .from(userIntelligenceTimelineTable)
    .where(and(
      eq(userIntelligenceTimelineTable.userId, userId),
      eq(userIntelligenceTimelineTable.eventType, eventType)
    ))
    .orderBy(desc(userIntelligenceTimelineTable.createdAt))
    .limit(1);

  if (rows.length === 0) return Infinity;
  return (Date.now() - new Date(rows[0].createdAt).getTime()) / 3_600_000;
}

/**
 * Analyse a user's memories and detect recurring patterns.
 * Rate-limited to once per PATTERN_RATE_LIMIT_HOURS.
 */
export async function detectAndSavePatterns(userId: string): Promise<void> {
  try {
    const memCount = await db
      .select({ count: count() })
      .from(userMemoryTable)
      .where(eq(userMemoryTable.userId, userId));

    if ((memCount[0]?.count ?? 0) < MIN_MEMORIES_FOR_PATTERNS) return;

    const ageSinceLastRun = await lastEventAge(userId, "pattern_detection_run");
    if (ageSinceLastRun < PATTERN_RATE_LIMIT_HOURS) return;

    // Fetch top 30 memories by combined_score for analysis
    const memories = await db
      .select({
        title: userMemoryTable.title,
        category: userMemoryTable.category,
        aiSummary: userMemoryTable.aiSummary,
        source: userMemoryTable.source,
        combinedScore: userMemoryTable.combinedScore,
      })
      .from(userMemoryTable)
      .where(and(eq(userMemoryTable.userId, userId), sql`memory_type != 'archived'`))
      .orderBy(desc(userMemoryTable.combinedScore))
      .limit(30);

    if (memories.length === 0) return;

    const memoryList = memories
      .map((m, i) => `${i + 1}. [${m.category}] ${m.title}${m.aiSummary ? ` — ${m.aiSummary}` : ""}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are an AI business intelligence analyst. Analyse these knowledge entries from a creator's business and identify 3–5 meaningful, specific patterns. Focus on: content preferences, pricing patterns, audience insights, platform behavior, product types, or growth patterns. Only identify patterns with clear evidence across multiple entries. Return ONLY valid JSON, no prose.`,
        },
        {
          role: "user",
          content: `Business knowledge entries:\n${memoryList}\n\nIdentify patterns. Return JSON:\n[\n  {\n    "pattern_type": "content|product|design|analytics|behavior|pricing",\n    "title": "short pattern title",\n    "description": "what this pattern means and why it matters for their business",\n    "confidence": 0.0-1.0,\n    "evidence": ["brief evidence point 1", "brief evidence point 2"]\n  }\n]`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const patterns = JSON.parse(jsonMatch[0]) as {
      pattern_type: string;
      title: string;
      description: string;
      confidence: number;
      evidence: string[];
    }[];

    // Deactivate old patterns first
    await db.update(userPatternsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(userPatternsTable.userId, userId), eq(userPatternsTable.isActive, true)));

    // Insert new patterns
    for (const p of patterns.slice(0, 5)) {
      const [inserted] = await db.insert(userPatternsTable)
        .values({
          userId,
          patternType: p.pattern_type ?? "behavior",
          title: String(p.title).slice(0, 200),
          description: String(p.description).slice(0, 1000),
          confidence: Math.min(Math.max(Number(p.confidence) || 0.5, 0), 1),
          occurrences: 1,
          isActive: true,
          metadata: { evidence: p.evidence ?? [] },
        })
        .returning();

      // Timeline: new pattern
      await recordTimelineEvent(userId, {
        eventType: "pattern_detected",
        title: `New pattern: ${p.title}`,
        description: p.description.slice(0, 200),
        patternId: inserted?.id,
      });
    }

    // Log the run itself (for rate-limiting)
    await recordTimelineEvent(userId, {
      eventType: "pattern_detection_run",
      title: `Pattern analysis complete — ${patterns.length} patterns found`,
    });
  } catch (err) {
    console.warn("[intelligence] pattern detection failed:", err);
  }
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export async function generateAndSaveRecommendations(userId: string): Promise<void> {
  try {
    const ageSinceLastRun = await lastEventAge(userId, "recommendations_run");
    if (ageSinceLastRun < RECS_RATE_LIMIT_HOURS) return;

    // Gather patterns + recent memories
    const [patterns, recentMemories] = await Promise.all([
      db.select().from(userPatternsTable)
        .where(and(eq(userPatternsTable.userId, userId), eq(userPatternsTable.isActive, true)))
        .orderBy(desc(userPatternsTable.confidence))
        .limit(5),
      db.select({
        title: userMemoryTable.title,
        category: userMemoryTable.category,
        aiSummary: userMemoryTable.aiSummary,
        source: userMemoryTable.source,
      })
        .from(userMemoryTable)
        .where(and(eq(userMemoryTable.userId, userId), sql`memory_type != 'archived'`))
        .orderBy(desc(userMemoryTable.updatedAt))
        .limit(10),
    ]);

    if (recentMemories.length === 0) return;

    const patternSummary = patterns.length > 0
      ? patterns.map(p => `- ${p.title}: ${p.description.slice(0, 150)}`).join("\n")
      : "No patterns detected yet.";

    const memorySummary = recentMemories
      .map((m, i) => `${i + 1}. [${m.category}] ${m.title}${m.aiSummary ? ` — ${m.aiSummary}` : ""}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are a proactive business AI. Based on patterns and recent knowledge, generate 3–4 specific, actionable recommendations for this creator. Be direct — tell them exactly what to do next. Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Detected patterns:\n${patternSummary}\n\nRecent knowledge:\n${memorySummary}\n\nGenerate recommendations:\n[\n  {\n    "rec_type": "action|insight|opportunity|warning",\n    "title": "short recommendation title",\n    "description": "specific, actionable recommendation (2–3 sentences)",\n    "priority": 1-10,\n    "confidence": 0.0-1.0,\n    "action_type": "create-product|run-research|create-experiment|create-content|null"\n  }\n]`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const recs = JSON.parse(jsonMatch[0]) as {
      rec_type: string;
      title: string;
      description: string;
      priority: number;
      confidence: number;
      action_type: string | null;
    }[];

    // Clear old un-dismissed recommendations
    await db.update(userRecommendationsTable)
      .set({ isDismissed: true })
      .where(and(eq(userRecommendationsTable.userId, userId), eq(userRecommendationsTable.isDismissed, false)));

    // Insert new
    for (const r of recs.slice(0, 4)) {
      await db.insert(userRecommendationsTable).values({
        userId,
        recType: r.rec_type ?? "insight",
        title: String(r.title).slice(0, 200),
        description: String(r.description).slice(0, 800),
        priority: Math.min(Math.max(Math.round(Number(r.priority) || 5), 1), 10),
        confidence: Math.min(Math.max(Number(r.confidence) || 0.7, 0), 1),
        actionType: r.action_type || null,
      });
    }

    await recordTimelineEvent(userId, {
      eventType: "recommendations_run",
      title: `${recs.length} new recommendations generated`,
    });
  } catch (err) {
    console.warn("[intelligence] recommendations failed:", err);
  }
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export async function recordTimelineEvent(
  userId: string,
  event: {
    eventType: string;
    title: string;
    description?: string;
    memoryId?: string;
    patternId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await db.insert(userIntelligenceTimelineTable).values({
      userId,
      eventType: event.eventType,
      title: event.title.slice(0, 300),
      description: event.description?.slice(0, 500),
      memoryId: event.memoryId as string | undefined,
      patternId: event.patternId as string | undefined,
      metadata: event.metadata ?? null,
    });
  } catch (err) {
    console.warn("[intelligence] timeline record failed:", err);
  }
}

// ─── Dashboard Data ───────────────────────────────────────────────────────────

export interface IntelligenceDashboard {
  knowledgeScore: number;           // 0–100
  totalMemories: number;
  memoriesThisWeek: number;
  memoriesCreatedToday: number;     // new
  patternsDetected: number;
  recommendationsAvailable: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>; // new — breakdown by category
  mostReferenced: {                       // new — highest usageCount
    id: string; title: string; category: string; usageCount: number;
  }[];
  patterns: {
    id: string; patternType: string; title: string; description: string;
    confidence: number; evidence: string[];
  }[];
  recommendations: {
    id: string; recType: string; title: string; description: string;
    priority: number; confidence: number; actionType: string | null;
  }[];
  timeline: {
    id: string; eventType: string; title: string; description: string | null; createdAt: string;
  }[];
  topMemories: {
    id: string; category: string; title: string; aiSummary: string | null; combinedScore: number; usageCount: number;
  }[];
}

const EMPTY_DASHBOARD: IntelligenceDashboard = {
  knowledgeScore: 0, totalMemories: 0, memoriesThisWeek: 0, memoriesCreatedToday: 0,
  patternsDetected: 0, recommendationsAvailable: 0, averageConfidence: 0,
  categoryCounts: {}, mostReferenced: [],
  patterns: [], recommendations: [], timeline: [], topMemories: [],
};

export async function getDashboardData(userId: string): Promise<IntelligenceDashboard> {
  const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  try {
    // ── 1. Memory aggregate stats — single SQL query, no embedding, no 200-row fetch
    const statsRows = await client.unsafe<{ total: string; avg_score: string; avg_confidence: string }[]>(
      `SELECT COUNT(*)::text AS total,
              COALESCE(AVG(combined_score), 0)::text AS avg_score,
              COALESCE(AVG(confidence_score), 0)::text AS avg_confidence
       FROM user_memory WHERE user_id = $1 AND memory_type != 'archived'`,
      [userId]
    ).catch(() => []);
    const stats = statsRows[0] ?? { total: "0", avg_score: "0", avg_confidence: "0" };

    // ── 2. Category breakdown — one query
    const catRows = await client.unsafe<{ category: string; cnt: string }[]>(
      `SELECT category, COUNT(*)::text AS cnt
       FROM user_memory WHERE user_id = $1 AND memory_type != 'archived'
       GROUP BY category`,
      [userId]
    ).catch(() => []);
    const categoryCounts: Record<string, number> = {};
    for (const r of catRows) categoryCounts[r.category] = parseInt(r.cnt, 10);

    // ── 3. All remaining queries run in parallel
    const [
      recentCount,
      todayCount,
      topMemories,
      mostReferenced,
      patterns,
      recommendations,
      timeline,
    ] = await Promise.all([
      db.select({ cnt: count() })
        .from(userMemoryTable)
        .where(and(eq(userMemoryTable.userId, userId), gt(userMemoryTable.createdAt, oneWeekAgo)))
        .then(r => Number(r[0]?.cnt ?? 0))
        .catch(() => 0),

      db.select({ cnt: count() })
        .from(userMemoryTable)
        .where(and(eq(userMemoryTable.userId, userId), gt(userMemoryTable.createdAt, todayStart)))
        .then(r => Number(r[0]?.cnt ?? 0))
        .catch(() => 0),

      db.select({
        id: userMemoryTable.id,
        category: userMemoryTable.category,
        title: userMemoryTable.title,
        aiSummary: userMemoryTable.aiSummary,
        combinedScore: userMemoryTable.combinedScore,
        usageCount: userMemoryTable.usageCount,
      })
        .from(userMemoryTable)
        .where(and(eq(userMemoryTable.userId, userId), sql`memory_type != 'archived'`))
        .orderBy(desc(userMemoryTable.combinedScore))
        .limit(5)
        .catch(() => []),

      db.select({
        id: userMemoryTable.id,
        title: userMemoryTable.title,
        category: userMemoryTable.category,
        usageCount: userMemoryTable.usageCount,
      })
        .from(userMemoryTable)
        .where(and(eq(userMemoryTable.userId, userId), sql`memory_type != 'archived'`))
        .orderBy(desc(userMemoryTable.usageCount))
        .limit(5)
        .catch(() => []),

      db.select()
        .from(userPatternsTable)
        .where(and(eq(userPatternsTable.userId, userId), eq(userPatternsTable.isActive, true)))
        .orderBy(desc(userPatternsTable.confidence))
        .limit(10)
        .catch(() => []),

      db.select()
        .from(userRecommendationsTable)
        .where(and(eq(userRecommendationsTable.userId, userId), eq(userRecommendationsTable.isDismissed, false)))
        .orderBy(desc(userRecommendationsTable.priority))
        .limit(5)
        .catch(() => []),

      db.select()
        .from(userIntelligenceTimelineTable)
        .where(and(
          eq(userIntelligenceTimelineTable.userId, userId),
          sql`event_type NOT IN ('pattern_detection_run', 'recommendations_run', 'score_update')`
        ))
        .orderBy(desc(userIntelligenceTimelineTable.createdAt))
        .limit(15)
        .catch(() => []),
    ]);

    return {
      knowledgeScore: Math.round(parseFloat(stats.avg_score) * 100),
      totalMemories: parseInt(stats.total, 10),
      memoriesThisWeek: recentCount,
      memoriesCreatedToday: todayCount,
      patternsDetected: patterns.length,
      recommendationsAvailable: recommendations.length,
      averageConfidence: Math.round(parseFloat(stats.avg_confidence) * 100) / 100,
      categoryCounts,
      mostReferenced: mostReferenced.map(m => ({
        id: m.id, title: m.title, category: m.category, usageCount: m.usageCount,
      })),
      patterns: patterns.map(p => ({
        id: p.id, patternType: p.patternType, title: p.title, description: p.description,
        confidence: p.confidence,
        evidence: (p.metadata as { evidence?: string[] } | null)?.evidence ?? [],
      })),
      recommendations: recommendations.map(r => ({
        id: r.id, recType: r.recType, title: r.title, description: r.description,
        priority: r.priority, confidence: r.confidence, actionType: r.actionType ?? null,
      })),
      timeline: timeline.map(t => ({
        id: t.id, eventType: t.eventType, title: t.title,
        description: t.description ?? null,
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
      })),
      topMemories: topMemories.map(m => ({
        id: m.id, category: m.category, title: m.title, aiSummary: m.aiSummary ?? null,
        combinedScore: m.combinedScore ?? 0.5, usageCount: m.usageCount,
      })),
    };
  } catch (err) {
    console.warn("[getDashboardData] error:", err);
    return EMPTY_DASHBOARD;
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Run the full intelligence pipeline for a user.
 * All operations are non-blocking — errors are swallowed.
 */
export async function runIntelligencePipeline(userId: string): Promise<void> {
  try {
    await updateMemoryScores(userId);
    await Promise.allSettled([
      detectAndSavePatterns(userId),
      generateAndSaveRecommendations(userId),
    ]);
  } catch (err) {
    console.warn("[intelligence] pipeline error:", err);
  }
}
