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
import { Eye, Heart, TrendingUp, Video, Loader2, RefreshCw } from "lucide-react";

type PlatformBreakdownRow = {
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

type BestVideoRow = {
  id: string;
  title: string;
  platform: string;
  views: number;
  engagement: string;
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

const chartConfigPlatform: ChartConfig = {
  views: { label: "Views", color: "#f97316" },
  likes: { label: "Likes", color: "#ec4899" },
  comments: { label: "Comments", color: "#8b5cf6" },
  shares: { label: "Shares", color: "#22c55e" },
  platform: { label: "Platform" },
};

const chartConfigGrowth: ChartConfig = {
  followers: { label: "Followers", color: "#f97316" },
  subscribers: { label: "Subscribers", color: "#3b82f6" },
  month: { label: "Month" },
};

const CARD_CLASS =
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-gray-300 dark:hover:border-[#3A3A3A] transition-colors";

export function VideoAnalyticsClient() {
  const [data, setData] = useState<VideoAnalyticsData | null>(null);
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

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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

  return (
    <>
      {/* Overview: Total views, Engagement rate, Videos published */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Total views (all platforms)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {d.totalViews.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Lifetime views</p>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Engagement rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {d.engagementRate}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Likes, comments & shares / views
              </p>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Video className="w-4 h-4" />
                Videos published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {d.videosPublished}
              </p>
              <p className="text-xs text-gray-500 mt-1">Across all platforms</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Platform breakdown: TikTok vs YouTube vs Instagram */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Platform breakdown
        </h2>
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              TikTok vs YouTube vs Instagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigPlatform} className="h-[240px] w-full">
              <BarChart data={d.platformBreakdown} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="platform" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="views"
                  fill="var(--color-views)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      {/* Growth over time: followers, subscribers */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Growth over time
        </h2>
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Followers & subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
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

      {/* Best performing videos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Best performing videos
        </h2>
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Video className="w-4 h-4" />
              Top by views
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
              {d.bestVideos.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Video className="w-5 h-5 text-orange-500" />
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
                No published videos with metrics yet. Publish from the{" "}
                <Link href="/dashboard/video-timeline" className="text-orange-500 hover:underline">
                  Video Timeline
                </Link>{" "}
                or add views/engagement in the Content Calendar.
              </div>
            )}
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
    </>
  );
}
