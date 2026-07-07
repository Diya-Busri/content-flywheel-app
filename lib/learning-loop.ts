/**
 * lib/learning-loop.ts — Phase 5.2
 * ──────────────────────────────────────────────────────────────────────────────
 * Continuous Learning Loop engine.
 *
 * Exports:
 *   scorePost()          — composite performance score for a post
 *   buildTrends()        — compute per-platform metric trends over time
 *   mergeLessons()       — deduplicate + reinforce lessons by category+key
 *   runLearningCycle()   — Claude AI: compare top vs bottom posts, extract lessons
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  PostAnalytics,
  LearningLesson,
  PerformanceTrend,
  LessonCategory,
  MarketingManagerId,
  LaunchStageResults,
  MemoryFact,
} from "@/db/schema/launch-schema";

const anthropic = new Anthropic();
function uid() { return Math.random().toString(36).slice(2, 10); }

/* ─── Composite performance scoring ─────────────────────────────────────────── */

/**
 * Composite score that normalises views + engagement rate + retention + CTR.
 * Used to stratify posts into top/bottom performers.
 */
export function scorePost(post: PostAnalytics): number {
  const m = post.metrics;
  const views = m.views ?? 0;
  if (views === 0) return 0;

  const interactions = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
  const engRate      = interactions / views;
  const retention    = (m.retention ?? 50) / 100;
  const ctr          = (m.ctr ?? 2) / 100;

  // Normalise views on a log scale so viral posts don't dominate completely
  const viewScore = Math.log10(Math.max(views, 1)) / 6; // log10(1M) ≈ 6

  return viewScore + engRate * 3 + retention * 2 + ctr * 2;
}

/* ─── Trend computation ──────────────────────────────────────────────────────── */

type MetricKey = "views" | "reach" | "retention" | "ctr" | "followersGained" | "likes" | "saves";

const TREND_METRICS: MetricKey[] = ["views", "reach", "retention", "ctr", "followersGained"];

function groupByWeek(posts: PostAnalytics[]): Map<string, PostAnalytics[]> {
  const weeks = new Map<string, PostAnalytics[]>();
  for (const post of posts) {
    const d   = new Date(post.publishedAt);
    const mon = new Date(d);
    mon.setDate(d.getDate() - d.getDay() + 1); // Monday of week
    const key = mon.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(post);
  }
  return new Map([...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function avgMetric(posts: PostAnalytics[], metric: MetricKey): number {
  const vals = posts.map(p => p.metrics[metric] ?? 0).filter(v => v > 0);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export function buildTrends(posts: PostAnalytics[]): PerformanceTrend[] {
  if (posts.length < 2) return [];

  const trends: PerformanceTrend[] = [];
  const platforms = [...new Set(posts.map(p => p.managerId))] as MarketingManagerId[];

  for (const platform of platforms) {
    const platformPosts = posts.filter(p => p.managerId === platform);
    if (platformPosts.length < 2) continue;

    const weeks = groupByWeek(platformPosts);
    const weekKeys = [...weeks.keys()];

    for (const metric of TREND_METRICS) {
      // Need at least 2 weeks or just compare first half vs second half
      let dataPoints: Array<{ date: string; value: number }>;

      if (weekKeys.length >= 2) {
        dataPoints = weekKeys.map(week => ({
          date:  week,
          value: Math.round(avgMetric(weeks.get(week)!, metric) * 10) / 10,
        })).filter(d => d.value > 0);
      } else {
        // Split posts in half chronologically
        const sorted = [...platformPosts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
        const mid    = Math.ceil(sorted.length / 2);
        const first  = sorted.slice(0, mid);
        const second = sorted.slice(mid);
        const v1 = avgMetric(first, metric);
        const v2 = avgMetric(second, metric);
        if (v1 === 0 && v2 === 0) continue;
        dataPoints = [
          { date: first[0].publishedAt.slice(0, 10),  value: Math.round(v1 * 10) / 10 },
          { date: second[0].publishedAt.slice(0, 10), value: Math.round(v2 * 10) / 10 },
        ];
      }

      if (dataPoints.length < 2) continue;

      const first  = dataPoints[0].value;
      const last   = dataPoints[dataPoints.length - 1].value;
      if (first === 0) continue;

      const changePercent = Math.round(((last - first) / first) * 100);
      const direction     = changePercent > 5 ? "up" : changePercent < -5 ? "down" : "stable";

      const metricLabel: Record<MetricKey, string> = {
        views: "Views", reach: "Reach", retention: "Retention",
        ctr: "CTR", followersGained: "Followers gained",
        likes: "Likes", saves: "Saves",
      };

      const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
      const sign = changePercent > 0 ? "+" : "";
      const summary = direction === "stable"
        ? `${platformLabel} ${metricLabel[metric]} is holding steady`
        : `${platformLabel} ${metricLabel[metric]} ${direction === "up" ? "improved" : "declined"} ${sign}${changePercent}% recently`;

      trends.push({ metric, platform, direction, changePercent, dataPoints, summary });
    }
  }

  return trends;
}

/* ─── Lesson deduplication ───────────────────────────────────────────────────── */

/**
 * Merges new lessons into existing ones.
 * Matching key: category + first 40 chars of lesson text (normalised).
 * On match: increment evidenceCount, update lastSeenAt, upgrade confidence.
 */
export function mergeLessons(
  existing: LearningLesson[],
  incoming: LearningLesson[],
): LearningLesson[] {
  const now = new Date().toISOString();

  // Key: category + normalised lesson snippet
  function lessonKey(l: LearningLesson) {
    return `${l.category}::${l.lesson.toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 40)}`;
  }

  const byKey = new Map<string, LearningLesson>();
  for (const lesson of existing) {
    byKey.set(lessonKey(lesson), lesson);
  }

  for (const lesson of incoming) {
    const k    = lessonKey(lesson);
    const prev = byKey.get(k);

    if (prev) {
      const evidenceCount = prev.evidenceCount + 1;
      const confidence    = evidenceCount >= 5 ? "high" : evidenceCount >= 2 ? "medium" : "low";
      byKey.set(k, {
        ...prev,
        evidence:      lesson.evidence, // update with latest evidence
        evidenceCount,
        confidence,
        lastSeenAt:    now,
        platforms:     [...new Set([...prev.platforms, ...lesson.platforms])],
      });
    } else {
      byKey.set(k, { ...lesson, firstSeenAt: now, lastSeenAt: now });
    }
  }

  // Sort: high confidence first, then by evidence count
  return [...byKey.values()].sort((a, b) => {
    const cOrd = { high: 0, medium: 1, low: 2 };
    return cOrd[a.confidence] - cOrd[b.confidence] || b.evidenceCount - a.evidenceCount;
  });
}

/* ─── AI: run learning cycle ─────────────────────────────────────────────────── */

type LearningCycleResult = {
  lessons:      LearningLesson[];
  todaysSummary: string;
  memoryFacts:  MemoryFact[];
};

export async function runLearningCycle(
  posts: PostAnalytics[],
  results: LaunchStageResults,
  existingLessons: LearningLesson[],
): Promise<LearningCycleResult> {

  const productName = results.product?.productName ?? "the business";

  if (posts.length === 0) {
    return { lessons: [], todaysSummary: "No posts to analyse yet.", memoryFacts: [] };
  }

  // Stratify: top 30% vs bottom 30% by composite score
  const scored  = posts.map(p => ({ post: p, score: scorePost(p) })).sort((a, b) => b.score - a.score);
  const topN    = Math.max(1, Math.ceil(scored.length * 0.3));
  const topPosts    = scored.slice(0, topN).map(x => x.post);
  const bottomPosts = scored.slice(-topN).map(x => x.post);

  function summarisePost(p: PostAnalytics, label: string, idx: number) {
    const m = p.metrics;
    return `${label} #${idx + 1} [${p.platform}]
  Hook: ${p.metadata.hook?.slice(0, 80) ?? "(none)"}
  CTA: ${p.metadata.cta?.slice(0, 60) ?? "(none)"}
  Type: ${p.managerId}
  Published: ${new Date(p.publishedAt).toLocaleTimeString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} on ${new Date(p.publishedAt).toLocaleDateString("en-GB", { weekday: "short" })}
  Views: ${(m.views ?? 0).toLocaleString()} | Reach: ${(m.reach ?? 0).toLocaleString()} | Retention: ${m.retention ?? "N/A"}% | CTR: ${m.ctr ?? "N/A"}% | Shares: ${m.shares ?? 0} | Saves: ${m.saves ?? 0}
  Existing insights: ${p.insights.slice(0, 2).map(i => i.text).join(" | ") || "(none yet)"}`;
  }

  const topContext    = topPosts.map((p, i) => summarisePost(p, "TOP", i)).join("\n\n");
  const bottomContext = bottomPosts.length > 0 ? bottomPosts.map((p, i) => summarisePost(p, "BOTTOM", i)).join("\n\n") : "Not enough data for bottom performers.";

  const existingLessonSummary = existingLessons.slice(0, 5)
    .map(l => `• [${l.category}] ${l.lesson} (evidence: ${l.evidenceCount}x)`)
    .join("\n") || "None yet.";

  const prompt = `You are a data-driven marketing analyst for ${productName}.

Your task: compare top-performing and bottom-performing content to extract reusable, evidence-based lessons that will make future content better.

TOP PERFORMERS (highest composite score):
${topContext}

BOTTOM PERFORMERS (lowest composite score):
${bottomContext}

LESSONS ALREADY KNOWN (do not duplicate these):
${existingLessonSummary}

Total posts analysed: ${posts.length}

Extract 4–8 NEW lessons that are:
- Specific and actionable (not generic marketing advice)
- Grounded in the actual metrics above
- Different from existing lessons
- Focused on what to REPLICATE or AVOID

Categories: hooks, cta, timing, format, style, topic, platform, avoid

Return JSON only:
{
  "lessons": [
    {
      "category": "hooks|cta|timing|format|style|topic|platform|avoid",
      "lesson": "Specific finding — what works or what to avoid",
      "evidence": "Metric evidence — e.g. 'Top hooks averaged 62% retention vs 28% for bottom'",
      "platforms": ["tiktok"],
      "confidence_hint": "low|medium|high"
    }
  ],
  "todaysSummary": "2 sentences: what the business learned and what it should do differently next time",
  "memoryFactsToAdd": [
    {
      "category": "marketing|analytics|lessons",
      "key": "machine_key",
      "label": "Human-readable label",
      "value": "Concise value to remember"
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: {
    lessons: Array<{
      category: string; lesson: string; evidence: string;
      platforms: string[]; confidence_hint: string;
    }>;
    todaysSummary: string;
    memoryFactsToAdd: Array<{ category: string; key: string; label: string; value: string }>;
  } = { lessons: [], todaysSummary: "", memoryFactsToAdd: [] };

  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch { /* ignore */ }

  const now = new Date().toISOString();

  const validCategories = new Set<LessonCategory>(["hooks","cta","timing","format","style","topic","platform","avoid"]);

  const newLessons: LearningLesson[] = (parsed.lessons ?? []).map(l => ({
    id:            uid(),
    category:      (validCategories.has(l.category as LessonCategory) ? l.category : "topic") as LessonCategory,
    lesson:        l.lesson,
    evidence:      l.evidence,
    evidenceCount: 1,
    confidence:    (["high","medium","low"].includes(l.confidence_hint) ? l.confidence_hint : "low") as LearningLesson["confidence"],
    platforms:     (l.platforms ?? []).filter(p => ["tiktok","instagram","youtube","x","linkedin","email","seo"].includes(p)) as MarketingManagerId[],
    firstSeenAt:   now,
    lastSeenAt:    now,
  }));

  // Promote high-evidence lessons to Business Memory
  const memoryFacts: MemoryFact[] = [
    ...(parsed.memoryFactsToAdd ?? []).map(f => ({
      id:              uid(),
      category:        f.category as MemoryFact["category"],
      key:             `learning_${f.key}`,
      label:           f.label,
      value:           f.value,
      source:          "learning",
      confidence:      "medium" as const,
      confirmedByUser: false,
      addedAt:         now,
      updatedAt:       now,
      evidenceCount:   1,
      lastReinforced:  now,
    })),
  ];

  // Also promote the best lessons directly as analytics facts
  for (const lesson of newLessons.filter(l => l.category !== "avoid").slice(0, 3)) {
    memoryFacts.push({
      id:              uid(),
      category:        "analytics" as const,
      key:             `lesson_${lesson.category}_${uid()}`,
      label:           `Learning: ${lesson.category}`,
      value:           lesson.lesson,
      source:          "learning",
      confidence:      lesson.confidence,
      confirmedByUser: false,
      addedAt:         now,
      updatedAt:       now,
      evidenceCount:   lesson.evidenceCount,
      lastReinforced:  now,
    });
  }

  return {
    lessons:       newLessons,
    todaysSummary: parsed.todaysSummary ?? "",
    memoryFacts,
  };
}
