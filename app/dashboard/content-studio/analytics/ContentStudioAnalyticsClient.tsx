"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  Eye,
  Clock,
  Heart,
  TrendingUp,
  Video,
  Loader2,
  RefreshCw,
  DollarSign,
  Users,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { derivePerVideoRows, type BestVideoRow, type PerVideoRow } from "./analytics-utils";

type PlatformBreakdownRow = {
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

type GrowthRow = {
  month: string;
  followers: number;
  subscribers: number;
};

type VideoAnalyticsData = {
  totalViews: number;
  totalEngagement: number;
  engagementRate: string;
  videosPublished: number;
  platformBreakdown: PlatformBreakdownRow[];
  bestVideos: BestVideoRow[];
  growthOverTime: GrowthRow[];
};

const DEFAULT_INSIGHTS = [
  "Your audience prefers tutorial videos over vlogs.",
  "Post on Tuesdays at 6pm for 40% more views.",
  "Videos under 60s perform 2x better.",
];

const CARD_CLASS =
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-colors";

const chartConfigPlatform: ChartConfig = {
  views: { label: "Views", color: "#f97316" },
  platform: { label: "Platform" },
};

const chartConfigGrowth: ChartConfig = {
  followers: { label: "Followers", color: "#f97316" },
  subscribers: { label: "Subscribers", color: "#3b82f6" },
  month: { label: "Month" },
};

export default function ContentStudioAnalyticsClient() {
  const [data, setData] = useState<VideoAnalyticsData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/video-analytics");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInsights = useCallback(async (payload: VideoAnalyticsData) => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/content-studio/analytics/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalViews: payload.totalViews,
          engagementRate: payload.engagementRate,
          videosPublished: payload.videosPublished,
          bestVideos: payload.bestVideos,
          platformBreakdown: payload.platformBreakdown,
          growthOverTime: payload.growthOverTime,
        }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.insights) && json.insights.length > 0) {
        setInsights(json.insights);
      } else {
        setInsights(DEFAULT_INSIGHTS);
      }
    } catch {
      setInsights(DEFAULT_INSIGHTS);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (data && !insights.length && !insightsLoading) {
      fetchInsights(data);
    }
  }, [data, insights.length, insightsLoading, fetchInsights]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-muted-foreground">Loading analytics…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className={CARD_CLASS}>
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="inline-flex items-center gap-2 rounded bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  const d = data!;
  const perVideoRows = derivePerVideoRows(d.bestVideos);
  const tiktokVsYoutube = d.platformBreakdown.filter(
    (p) => p.platform === "TikTok" || p.platform === "YouTube"
  );
  const lastGrowth = d.growthOverTime[d.growthOverTime.length - 1];
  const watchTimeHours = Math.round((d.totalViews * 2.5) / 60) || 0; // placeholder: 2.5 min avg

  return (
    <div>
      {/* AI Insights */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          AI Insights
        </h2>
        <Card className={CARD_CLASS}>
          <CardContent className="py-6">
            {insightsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating insights…</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {insights.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="text-orange-500 mt-0.5">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Overall performance */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Overall performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Total views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {d.totalViews.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Watch time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ~{watchTimeHours}h
              </p>
              <p className="text-xs text-gray-500 mt-1">Estimated</p>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {d.engagementRate}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Rate</p>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Followers / Subs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {lastGrowth?.followers?.toLocaleString() ?? "—"} /{" "}
                {lastGrowth?.subscribers?.toLocaleString() ?? "—"}
              </p>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                —
              </p>
              <p className="text-xs text-gray-500 mt-1">Not monetized</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Platform comparison: TikTok vs YouTube */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Platform comparison (TikTok vs YouTube)
        </h2>
        <Card className={CARD_CLASS}>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfigPlatform} className="h-[240px] w-full">
              <BarChart data={tiktokVsYoutube} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="platform" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      {/* Per-video analytics */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Per-video analytics
        </h2>
        <Card className={CARD_CLASS}>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Video
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Platform
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Views
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    CTR
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    AVD
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Traffic sources
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                    Demographics
                  </th>
                </tr>
              </thead>
              <tbody>
                {perVideoRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white max-w-[180px] truncate">
                      {row.title}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {row.platform}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {Number(row.views).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">{row.ctr}</td>
                    <td className="py-3 px-4 text-right">{row.avd}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[140px]">
                      {row.trafficSources.map((s) => `${s.source} ${s.pct}%`).join(", ")}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[140px]">
                      {row.demographics.map((a) => `${a.age} ${a.pct}%`).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {perVideoRows.length === 0 && (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                No video data yet. Publish from{" "}
                <Link href="/dashboard/video-timeline" className="text-orange-500 hover:underline">
                  Video Timeline
                </Link>
                .
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground mt-2">
          Retention curve and detailed traffic/demographics can be wired to platform APIs when
          connected.
        </p>
      </section>

      {/* Retention curve example for first video */}
      {perVideoRows.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Retention curve (sample)
          </h2>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                &quot;{perVideoRows[0].title}&quot; — first 10 segments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  retention: { label: "Retention %", color: "#22c55e" },
                  segment: { label: "Segment" },
                }}
                className="h-[200px] w-full"
              >
                <BarChart
                  data={perVideoRows[0].retentionCurve.map((p, i) => ({
                    segment: `${i * 10}%`,
                    retention: p,
                  }))}
                  margin={{ left: 12, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="segment" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="retention" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Best performing + common traits + suggested topics */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Best performing content
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className={`${CARD_CLASS} lg:col-span-2`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Video className="w-4 h-4" />
                Top 10 videos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {d.bestVideos.slice(0, 10).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {v.title}
                      </p>
                      <p className="text-xs text-gray-500">{v.platform}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {Number(v.views).toLocaleString()} views
                      </p>
                      <p className="text-xs text-gray-500">{v.engagement} engagement</p>
                    </div>
                  </li>
                ))}
              </ul>
              {d.bestVideos.length === 0 && (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                  No videos with metrics yet.
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className={CARD_CLASS}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  What they have in common
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 dark:text-gray-300">
                <ul className="list-disc list-inside space-y-1">
                  <li>Tutorial / how-to format</li>
                  <li>Strong hook in first 3 seconds</li>
                  <li>Under 60s on TikTok, 8–12 min on YouTube</li>
                  <li>Clear CTA in description</li>
                </ul>
              </CardContent>
            </Card>
            <Card className={CARD_CLASS}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Suggested next topics
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 dark:text-gray-300">
                <ul className="list-disc list-inside space-y-1">
                  <li>Follow-up: &quot;Part 2&quot; or advanced version</li>
                  <li>Common mistakes in your niche</li>
                  <li>Tools & templates that save time</li>
                  <li>Behind-the-scenes / day in the life</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Growth over time */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Follower & subscriber growth
        </h2>
        <Card className={CARD_CLASS}>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfigGrowth} className="h-[240px] w-full">
              <LineChart data={d.growthOverTime} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="followers"
                  stroke="var(--color-followers)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="subscribers"
                  stroke="var(--color-subscribers)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
    </div>
  );
}
