/**
 * lib/smart-scheduler.ts — Phase 5.3
 * ──────────────────────────────────────────────────────────────────────────────
 * AI-powered publishing schedule recommendation.
 *
 * Uses:
 *   • Business Memory analytics facts (what posting times the AI previously learned)
 *   • Existing PostAnalytics trends (empirical best-performing publish times)
 *   • Platform-specific priors (baseline best-practice windows per channel)
 *
 * Returns a ScheduleRecommendation with a concrete next ISO datetime.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ScheduleRecommendation,
  LaunchStageResults,
  MarketingManagerId,
  PostAnalytics,
} from "@/db/schema/launch-schema";
import { scorePost } from "@/lib/learning-loop";
import { buildMemoryContext } from "@/lib/memory-context";

const anthropic = new Anthropic();

/* ─── Platform baseline windows (UTC) ───────────────────────────────────────── */

type TimeWindow = { day: string; hour: number; reason: string };

const PLATFORM_WINDOWS: Record<MarketingManagerId, TimeWindow[]> = {
  tiktok:    [
    { day: "Tuesday",   hour: 19, reason: "Evening scroll peak, 7-9pm engagement spike" },
    { day: "Thursday",  hour: 18, reason: "Pre-weekend entertainment peak" },
    { day: "Friday",    hour: 17, reason: "End-of-week casual browsing" },
  ],
  instagram: [
    { day: "Wednesday", hour: 11, reason: "Midweek lunch-break browsing" },
    { day: "Monday",    hour: 18, reason: "Post-work catch-up" },
    { day: "Saturday",  hour: 10, reason: "Weekend morning leisure" },
  ],
  youtube:   [
    { day: "Sunday",    hour: 14, reason: "Weekend afternoon viewing peak" },
    { day: "Saturday",  hour: 13, reason: "Midday lean-back viewing" },
    { day: "Thursday",  hour: 17, reason: "Pre-weekend discovery" },
  ],
  x:         [
    { day: "Wednesday", hour: 9,  reason: "Morning news cycle peak" },
    { day: "Tuesday",   hour: 8,  reason: "Early professional commute" },
    { day: "Thursday",  hour: 10, reason: "Mid-week professional discussion" },
  ],
  linkedin:  [
    { day: "Tuesday",   hour: 8,  reason: "Professional morning routine" },
    { day: "Wednesday", hour: 8,  reason: "Peak B2B engagement day" },
    { day: "Thursday",  hour: 9,  reason: "Networking day peak" },
  ],
  email:     [
    { day: "Tuesday",   hour: 10, reason: "Post-Monday inbox clear-out" },
    { day: "Thursday",  hour: 10, reason: "End-of-week action window" },
    { day: "Wednesday", hour: 11, reason: "Midweek reading peak" },
  ],
  seo:       [
    { day: "Monday",    hour: 9,  reason: "Start-of-week research spike" },
    { day: "Tuesday",   hour: 9,  reason: "High organic search day" },
    { day: "Wednesday", hour: 10, reason: "Mid-week peak search volume" },
  ],
};

const PLATFORM_ORDER: MarketingManagerId[] = [
  "tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo",
];

/* ─── Extract empirical best window from PostAnalytics ──────────────────────── */

type EmpiricalSlot = { dayOfWeek: string; hourOfDay: number; avgScore: number };

function extractEmpiricalSlots(posts: PostAnalytics[], managerId: MarketingManagerId): EmpiricalSlot[] {
  const relevantPosts = posts.filter(p => p.managerId === managerId && p.analysedAt);
  if (relevantPosts.length < 3) return [];

  const slotMap = new Map<string, { scores: number[]; hour: number }>();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  for (const post of relevantPosts) {
    const d   = new Date(post.publishedAt);
    const day = DAYS[d.getUTCDay()];
    const hr  = d.getUTCHours();
    const key = `${day}::${hr}`;
    if (!slotMap.has(key)) slotMap.set(key, { scores: [], hour: hr });
    slotMap.get(key)!.scores.push(scorePost(post));
  }

  return [...slotMap.entries()]
    .map(([key, v]) => ({
      dayOfWeek: key.split("::")[0],
      hourOfDay: v.hour,
      avgScore:  v.scores.reduce((s, x) => s + x, 0) / v.scores.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3);
}

/* ─── Next ISO datetime for a given day + hour (UTC) ────────────────────────── */

function nextDatetimeForDayHour(dayName: string, hour: number): string {
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const targetDay = DAYS.indexOf(dayName);
  if (targetDay === -1) return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // fallback 3h from now

  const now  = new Date();
  const diff = (targetDay - now.getUTCDay() + 7) % 7 || 7; // at least 1 day ahead
  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + diff);
  target.setUTCHours(hour, 0, 0, 0);
  return target.toISOString();
}

/* ─── Main: getScheduleRecommendation ───────────────────────────────────────── */

export async function getScheduleRecommendation(
  content:    string,
  managerId:  MarketingManagerId,
  results:    LaunchStageResults,
): Promise<ScheduleRecommendation> {

  const productName     = results.product?.productName ?? "the business";
  const memoryContext   = buildMemoryContext(results.memory, ["analytics", "marketing", "lessons"], 8);
  const posts           = results.analyticsDept?.posts ?? [];
  const empiricalSlots  = extractEmpiricalSlots(posts, managerId);
  const baselineWindows = PLATFORM_WINDOWS[managerId] ?? PLATFORM_WINDOWS.tiktok;
  const lessons         = results.analyticsDept?.lessons ?? [];
  const timingLessons   = lessons.filter(l => l.category === "timing").slice(0, 3);

  // Platform priority: sort by which platforms have the most posted+analysed content
  const platformScores = PLATFORM_ORDER.map(pid => ({
    pid,
    score: posts.filter(p => p.managerId === pid && p.analysedAt).length,
  })).sort((a, b) => b.score - a.score);
  const platformOrder  = platformScores.map(p => p.pid);

  const empiricalContext = empiricalSlots.length > 0
    ? `Empirical best slots for ${managerId} (from real post performance):\n` +
      empiricalSlots.map(s => `  • ${s.dayOfWeek} at ${s.hourOfDay}:00 UTC (avg performance score: ${s.avgScore.toFixed(3)})`).join("\n")
    : "No empirical data yet for this platform — use platform priors.";

  const timingLessonContext = timingLessons.length > 0
    ? "Timing lessons already learned:\n" + timingLessons.map(l => `  • ${l.lesson} (evidence: ${l.evidence})`).join("\n")
    : "No timing lessons yet.";

  const prompt = `You are a publishing strategist for ${productName}.

Choose the single best day and time to publish the following content on ${managerId}.

CONTENT TO PUBLISH:
${content.slice(0, 400)}

${empiricalContext}

PLATFORM PRIORS for ${managerId}:
${baselineWindows.map(w => `  • ${w.day} at ${w.hour}:00 UTC — ${w.reason}`).join("\n")}

${timingLessonContext}

${memoryContext ? `BUSINESS MEMORY CONTEXT:\n${memoryContext}` : ""}

Return JSON only:
{
  "bestDay":    "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
  "bestTime":   "HH:MM",
  "reasoning":  "1–2 sentences grounded in the data above, not generic advice"
}`;

  let bestDay  = baselineWindows[0].day;
  let bestTime = `${String(baselineWindows[0].hour).padStart(2,"0")}:00`;
  let reasoning = `${managerId} performs best on ${bestDay}s at ${bestTime} based on platform benchmarks.`;

  try {
    const resp = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = resp.content[0].type === "text" ? resp.content[0].text : "";
    const m   = raw.match(/\{[\s\S]*\}/);

    if (m) {
      const parsed = JSON.parse(m[0]) as { bestDay?: string; bestTime?: string; reasoning?: string };
      if (parsed.bestDay)   bestDay   = parsed.bestDay;
      if (parsed.bestTime)  bestTime  = parsed.bestTime;
      if (parsed.reasoning) reasoning = parsed.reasoning;
    }
  } catch { /* fall back to priors */ }

  const hour = parseInt(bestTime.split(":")[0], 10) || baselineWindows[0].hour;
  const scheduledAt = nextDatetimeForDayHour(bestDay, hour);

  return {
    bestDay,
    bestTime,
    bestPlatform:  managerId,
    platformOrder: [managerId, ...platformOrder.filter(p => p !== managerId)],
    reasoning,
    scheduledAt,
  };
}
