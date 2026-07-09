/**
 * analytics-ai.ts — Phase 5.1
 * ──────────────────────────────────────────────────────────────────────────────
 * AI analyst engine for Analytics Intelligence.
 *
 * simulateMetrics()         — realistic platform-specific metrics (no real OAuth needed)
 * analyzePost()             — Claude AI: qualitative insights per post
 * generateDailyReport()     — Claude AI: daily intelligence briefing
 * extractAnalyticsMemoryFacts() — convert insights → Business Memory facts
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  MarketingManagerId,
  PostAnalytics,
  AnalyticsMetrics,
  ContentMetadata,
  AnalyticsInsight,
  AnalyticsRecommendation,
  DailyIntelligenceReport,
  LaunchStageResults,
  MemoryFact,
} from "@/db/schema/launch-schema";

const anthropic = new Anthropic();

function uid() { return Math.random().toString(36).slice(2, 10); }

/* ─── Platform metric profiles ───────────────────────────────────────────────── */

type MetricProfile = {
  viewsRange:      [number, number];
  reachMultiplier: number;
  retentionRange:  [number, number];
  watchTimeRange:  [number, number]; // seconds
  likeRate:        number;           // fraction of views
  commentRate:     number;
  shareRate:       number;
  saveRate:        number;
  ctrRange:        [number, number];
  followersRange:  [number, number];
};

const PLATFORM_PROFILES: Record<MarketingManagerId, MetricProfile> = {
  tiktok: {
    viewsRange:      [3_000, 250_000],
    reachMultiplier: 1.1,
    retentionRange:  [35, 72],
    watchTimeRange:  [4, 18],
    likeRate:        0.06,
    commentRate:     0.008,
    shareRate:       0.025,
    saveRate:        0.018,
    ctrRange:        [1.2, 4.5],
    followersRange:  [5, 400],
  },
  instagram: {
    viewsRange:      [800, 60_000],
    reachMultiplier: 0.85,
    retentionRange:  [30, 65],
    watchTimeRange:  [3, 12],
    likeRate:        0.045,
    commentRate:     0.005,
    shareRate:       0.012,
    saveRate:        0.03,
    ctrRange:        [0.8, 3.2],
    followersRange:  [2, 120],
  },
  youtube: {
    viewsRange:      [200, 40_000],
    reachMultiplier: 0.9,
    retentionRange:  [38, 68],
    watchTimeRange:  [90, 480],
    likeRate:        0.04,
    commentRate:     0.006,
    shareRate:       0.008,
    saveRate:        0.01,
    ctrRange:        [2.5, 8.0],
    followersRange:  [1, 80],
  },
  x: {
    viewsRange:      [1_000, 80_000],
    reachMultiplier: 1.2,
    retentionRange:  [0, 0],
    watchTimeRange:  [0, 0],
    likeRate:        0.025,
    commentRate:     0.004,
    shareRate:       0.015,
    saveRate:        0.008,
    ctrRange:        [0.5, 2.8],
    followersRange:  [1, 60],
  },
  linkedin: {
    viewsRange:      [400, 20_000],
    reachMultiplier: 0.95,
    retentionRange:  [0, 0],
    watchTimeRange:  [0, 0],
    likeRate:        0.035,
    commentRate:     0.012,
    shareRate:       0.02,
    saveRate:        0.015,
    ctrRange:        [1.5, 5.0],
    followersRange:  [1, 40],
  },
  email: {
    viewsRange:      [100, 8_000],
    reachMultiplier: 1.0,
    retentionRange:  [0, 0],
    watchTimeRange:  [0, 0],
    likeRate:        0.0,
    commentRate:     0.0,
    shareRate:       0.0,
    saveRate:        0.0,
    ctrRange:        [1.8, 7.5],
    followersRange:  [0, 0],
  },
  seo: {
    viewsRange:      [50, 5_000],
    reachMultiplier: 0.8,
    retentionRange:  [0, 0],
    watchTimeRange:  [0, 0],
    likeRate:        0.0,
    commentRate:     0.002,
    shareRate:       0.005,
    saveRate:        0.008,
    ctrRange:        [2.0, 9.0],
    followersRange:  [0, 5],
  },
};

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function randFloat(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

/* ─── Simulate metrics ───────────────────────────────────────────────────────── */

export function simulateMetrics(
  managerId: MarketingManagerId,
  content: string,
  publishedAt: string,
): AnalyticsMetrics {
  const p = PLATFORM_PROFILES[managerId];
  const views = rand(...p.viewsRange);
  const reach  = Math.round(views * p.reachMultiplier);

  // Slightly more variance for older posts (more time to accumulate)
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  const ageFactor = Math.min(1 + ageHours / 72, 2.5);

  const boosted = Math.round(views * ageFactor);

  const metrics: AnalyticsMetrics = {
    views:           boosted,
    reach:           Math.round(reach * ageFactor),
    impressions:     Math.round(boosted * 1.3),
    likes:           Math.round(boosted * p.likeRate),
    comments:        Math.round(boosted * p.commentRate),
    shares:          Math.round(boosted * p.shareRate),
    saves:           Math.round(boosted * p.saveRate),
    ctr:             randFloat(...p.ctrRange),
    followersGained: rand(...p.followersRange),
    profileVisits:   Math.round(boosted * 0.04),
    linkClicks:      Math.round(boosted * (p.ctrRange[0] / 100)),
    lastFetched:     new Date().toISOString(),
  };

  if (p.retentionRange[1] > 0) {
    metrics.retention  = rand(...p.retentionRange);
    metrics.watchTime  = rand(...p.watchTimeRange);
  }

  // Email: opens = views, no retention/watchtime
  if (managerId === "email") {
    metrics.conversions = Math.round(boosted * 0.018);
    delete metrics.retention;
    delete metrics.watchTime;
  }

  return metrics;
}

/* ─── Extract content metadata from published content ───────────────────────── */

export function extractContentMetadata(
  content: string,
  outputType: string,
): ContentMetadata {
  const meta: ContentMetadata = {};

  try {
    const parsed = JSON.parse(content);

    if (outputType === "tweet_thread") {
      meta.hook    = (parsed.tweets as string[])?.[0]?.slice(0, 120);
      meta.caption = (parsed.tweets as string[])?.join(" ").slice(0, 200);
    } else if (outputType === "email") {
      meta.hook    = parsed.subject;
      meta.cta     = parsed.cta;
      meta.caption = parsed.body?.slice(0, 200);
    } else if (outputType === "carousel") {
      meta.hook    = parsed.hook;
      meta.cta     = parsed.cta;
    } else if (outputType === "video_script" || outputType === "script_outline") {
      meta.hook    = parsed.hook;
      meta.cta     = parsed.cta;
      meta.topic   = parsed.topic;
    } else if (outputType === "blog_outline") {
      meta.hook    = parsed.title;
      meta.topic   = parsed.topic;
    } else if (outputType === "keyword_cluster") {
      meta.topic   = parsed.primary;
    } else {
      meta.caption = content.slice(0, 200);
      meta.hook    = content.slice(0, 80);
    }
  } catch {
    meta.caption = content.slice(0, 200);
    meta.hook    = content.slice(0, 80);
  }

  // Extract hashtags
  const tags = content.match(/#\w+/g);
  if (tags) meta.hashtags = [...new Set(tags)].slice(0, 10);

  return meta;
}

/* ─── AI: analyze a single post ─────────────────────────────────────────────── */

export async function analyzePost(
  post: PostAnalytics,
  results: LaunchStageResults,
): Promise<{ insights: AnalyticsInsight[]; memoryFacts: MemoryFact[] }> {
  const m = post.metrics;
  const meta = post.metadata;

  const productName = results.product?.productName ?? "Unknown Product";

  const metricsText = [
    m.views      ? `Views: ${m.views.toLocaleString()}`     : null,
    m.reach      ? `Reach: ${m.reach.toLocaleString()}`     : null,
    m.retention  ? `Retention: ${m.retention}%`             : null,
    m.watchTime  ? `Avg watch time: ${m.watchTime}s`        : null,
    m.likes      ? `Likes: ${m.likes.toLocaleString()}`     : null,
    m.comments   ? `Comments: ${m.comments.toLocaleString()}` : null,
    m.shares     ? `Shares: ${m.shares.toLocaleString()}`   : null,
    m.saves      ? `Saves: ${m.saves.toLocaleString()}`     : null,
    m.ctr        ? `CTR: ${m.ctr}%`                         : null,
    m.conversions ? `Conversions: ${m.conversions}`         : null,
    m.followersGained ? `Followers gained: ${m.followersGained}` : null,
  ].filter(Boolean).join("\n");

  const contentSample = post.content.slice(0, 400);

  const prompt = `You are an expert social media analyst for a creator/product business.

Product: ${productName}
Platform: ${post.platform}
Content type: ${post.managerId}
Published: ${new Date(post.publishedAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}

Content (excerpt):
${contentSample}

Hook: ${meta.hook ?? "Not identified"}
CTA: ${meta.cta ?? "Not identified"}
Hashtags: ${meta.hashtags?.join(", ") ?? "None"}

Metrics:
${metricsText}

Generate 3–5 qualitative insights about this post's performance. Be specific and analytical:
- Explain WHY metrics are high or low (not just that they are)
- Reference the actual hook, CTA, or content elements
- Compare to platform benchmarks where relevant
- Identify what to replicate or avoid

Return JSON with this structure:
{
  "insights": [
    {
      "type": "win"|"problem"|"trend"|"anomaly"|"recommendation",
      "text": "Specific, actionable analytical sentence",
      "evidence": "The supporting metric(s)",
      "metric": "primary metric name",
      "confidence": "high"|"medium"|"low"
    }
  ],
  "memoryFacts": [
    {
      "category": "analytics"|"marketing"|"audience",
      "key": "machine_key",
      "label": "Human label",
      "value": "Concise value"
    }
  ]
}

Keep insights conversational but expert. No bullet lists inside the text field. Max 2 memory facts.`;

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: { insights: Array<{ type: string; text: string; evidence?: string; metric?: string; confidence: string }>; memoryFacts: Array<{ category: string; key: string; label: string; value: string }> } = {
    insights: [],
    memoryFacts: [],
  };

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { /* ignore — return empty */ }

  const now = new Date().toISOString();

  const insights: AnalyticsInsight[] = (parsed.insights ?? []).map(i => ({
    id:         uid(),
    type:       (["win","problem","trend","anomaly","recommendation"].includes(i.type) ? i.type : "trend") as AnalyticsInsight["type"],
    text:       i.text,
    evidence:   i.evidence,
    metric:     i.metric,
    confidence: (["high","medium","low"].includes(i.confidence) ? i.confidence : "medium") as AnalyticsInsight["confidence"],
    createdAt:  now,
  }));

  const memoryFacts: MemoryFact[] = (parsed.memoryFacts ?? []).map(f => ({
    id:              uid(),
    category:        f.category as MemoryFact["category"],
    key:             `analytics_${f.key}`,
    label:           f.label,
    value:           f.value,
    source:          `analytics:${post.managerId}`,
    confidence:      "medium" as const,
    confirmedByUser: false,
    addedAt:         now,
    updatedAt:       now,
  }));

  return { insights, memoryFacts };
}

/* ─── AI: generate daily intelligence report ─────────────────────────────────── */

export async function generateDailyReport(
  posts: PostAnalytics[],
  results: LaunchStageResults,
  date: string,
): Promise<DailyIntelligenceReport> {
  const productName = results.product?.productName ?? "Unknown Product";

  const totalReach      = posts.reduce((n, p) => n + (p.metrics.reach ?? 0), 0);
  const totalViews      = posts.reduce((n, p) => n + (p.metrics.views ?? 0), 0);
  const followersGained = posts.reduce((n, p) => n + (p.metrics.followersGained ?? 0), 0);
  const sales           = posts.reduce((n, p) => n + (p.metrics.sales ?? 0), 0);
  const revenue         = posts.reduce((n, p) => n + (p.metrics.revenue ?? 0), 0);

  // Identify biggest win (highest reach post)
  const sortedByReach = [...posts].sort((a, b) => (b.metrics.reach ?? 0) - (a.metrics.reach ?? 0));
  const winPost = sortedByReach[0];

  // Identify biggest problem (lowest retention or CTR)
  const sortedByPerf = [...posts].sort((a, b) => {
    const scoreA = (a.metrics.retention ?? 50) + (a.metrics.ctr ?? 2);
    const scoreB = (b.metrics.retention ?? 50) + (b.metrics.ctr ?? 2);
    return scoreA - scoreB;
  });
  const problemPost = sortedByPerf[0];

  // Collect all existing insights
  const allInsights = posts.flatMap(p => p.insights ?? []);

  const postsContext = posts.map(p => {
    const m = p.metrics;
    return `Platform: ${p.platform} | Type: ${p.managerId}
Hook: ${p.metadata.hook?.slice(0, 80) ?? "N/A"}
Views: ${(m.views ?? 0).toLocaleString()} | Reach: ${(m.reach ?? 0).toLocaleString()} | Retention: ${m.retention ?? "N/A"}% | CTR: ${m.ctr ?? "N/A"}%
Followers: +${m.followersGained ?? 0}
Key insights: ${(p.insights ?? []).slice(0, 2).map(i => i.text).join(" | ") || "Not yet analysed"}`;
  }).join("\n\n");

  const prompt = `You are Mission Control — the AI CEO analyst for a creator/product business.

Product: ${productName}
Report date: ${date}
Posts published today: ${posts.length}

PERFORMANCE SUMMARY:
Total reach: ${totalReach.toLocaleString()}
Total views: ${totalViews.toLocaleString()}
Followers gained: +${followersGained}
Sales: ${sales}
Revenue: £${revenue.toFixed(2)}

PUBLISHED POSTS:
${postsContext || "No posts published today."}

Generate a daily intelligence briefing with:
1. A 2–3 sentence narrative summary (what happened, what it means, what to do tomorrow)
2. 3–5 strategic insights (trends across posts, patterns, what's working)
3. 4–6 specific recommendations (actionable, grounded in today's data)

Return JSON:
{
  "narrative": "2-3 sentence prose briefing for the founder",
  "insights": [
    {
      "type": "win"|"problem"|"trend"|"recommendation",
      "text": "Specific insight text",
      "evidence": "Supporting data",
      "metric": "metric name",
      "confidence": "high"|"medium"|"low"
    }
  ],
  "recommendations": [
    {
      "text": "Specific action to take",
      "reasoning": "Why, grounded in today's data",
      "impact": "high"|"medium"|"low",
      "category": "content"|"timing"|"hooks"|"cta"|"format"|"hashtags"|"topic"|"platform",
      "managerId": "tiktok"|"instagram"|"youtube"|"x"|"linkedin"|"email"|"seo"|null
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
    narrative: string;
    insights: Array<{ type: string; text: string; evidence?: string; metric?: string; confidence: string }>;
    recommendations: Array<{ text: string; reasoning: string; impact: string; category: string; managerId?: string }>;
  } = { narrative: "", insights: [], recommendations: [] };

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { /* ignore */ }

  const now = new Date().toISOString();

  const insights: AnalyticsInsight[] = (parsed.insights ?? []).map(i => ({
    id:         uid(),
    type:       (["win","problem","trend","anomaly","recommendation"].includes(i.type) ? i.type : "trend") as AnalyticsInsight["type"],
    text:       i.text,
    evidence:   i.evidence,
    metric:     i.metric,
    confidence: (["high","medium","low"].includes(i.confidence) ? i.confidence : "medium") as AnalyticsInsight["confidence"],
    createdAt:  now,
  }));

  const recommendations: AnalyticsRecommendation[] = (parsed.recommendations ?? []).map(r => ({
    id:         uid(),
    text:       r.text,
    reasoning:  r.reasoning,
    impact:     (["high","medium","low"].includes(r.impact) ? r.impact : "medium") as AnalyticsRecommendation["impact"],
    category:   r.category as AnalyticsRecommendation["category"],
    managerId:  r.managerId as MarketingManagerId | undefined,
    status:     "pending" as const,
    createdAt:  now,
  }));

  const report: DailyIntelligenceReport = {
    id:   uid(),
    date,
    summary: {
      postsPublished:  posts.length,
      totalReach,
      totalViews,
      followersGained,
      sales,
      revenue,
    },
    biggestWin: winPost ? {
      postId:   winPost.id,
      platform: winPost.platform,
      reason:   (winPost.insights.find(i => i.type === "win")?.text ?? "Highest reach post today"),
      metric:   "reach",
      value:    winPost.metrics.reach ?? 0,
    } : undefined,
    biggestProblem: problemPost ? {
      postId:      problemPost.id,
      platform:    problemPost.platform,
      description: problemPost.insights.find(i => i.type === "problem")?.text ?? "Lowest performing post today",
    } : undefined,
    insights,
    recommendations,
    narrative:    parsed.narrative ?? "",
    generatedAt:  now,
  };

  return report;
}

/* ─── Extract analytics memory facts from report ─────────────────────────────── */

export function extractAnalyticsMemoryFacts(
  insights: AnalyticsInsight[],
  recommendations: AnalyticsRecommendation[],
): MemoryFact[] {
  const now = new Date().toISOString();
  const facts: MemoryFact[] = [];

  const wins     = insights.filter(i => i.type === "win").slice(0, 3);
  const problems = insights.filter(i => i.type === "problem").slice(0, 2);
  const trends   = insights.filter(i => i.type === "trend").slice(0, 2);

  wins.forEach((insight, idx) => {
    facts.push({
      id:              uid(),
      category:        "analytics",
      key:             `winning_pattern_${idx}`,
      label:           "Winning content pattern",
      value:           insight.text,
      source:          "analytics:report",
      confidence:      insight.confidence,
      confirmedByUser: false,
      addedAt:         now,
      updatedAt:       now,
    });
  });

  problems.forEach((insight, idx) => {
    facts.push({
      id:              uid(),
      category:        "analytics",
      key:             `content_mistake_${idx}`,
      label:           "Content mistake to avoid",
      value:           insight.text,
      source:          "analytics:report",
      confidence:      insight.confidence,
      confirmedByUser: false,
      addedAt:         now,
      updatedAt:       now,
    });
  });

  trends.forEach((insight, idx) => {
    facts.push({
      id:              uid(),
      category:        "marketing",
      key:             `content_trend_${idx}`,
      label:           "Content trend",
      value:           insight.text,
      source:          "analytics:report",
      confidence:      insight.confidence,
      confirmedByUser: false,
      addedAt:         now,
      updatedAt:       now,
    });
  });

  const highImpactRecs = recommendations.filter(r => r.impact === "high").slice(0, 2);
  highImpactRecs.forEach((rec, idx) => {
    facts.push({
      id:              uid(),
      category:        "marketing",
      key:             `high_impact_action_${idx}`,
      label:           "High-impact recommendation",
      value:           rec.text,
      source:          "analytics:report",
      confidence:      "high",
      confirmedByUser: false,
      addedAt:         now,
      updatedAt:       now,
    });
  });

  return facts;
}
